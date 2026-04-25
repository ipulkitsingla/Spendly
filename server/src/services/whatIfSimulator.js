import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';

const MONTHS_BACK = 3;
const DEFAULT_DURATION_MONTHS = 3;
const AVG_DAYS_IN_MONTH = 30.4375;
const AVG_WEEKS_IN_MONTH = 4.345;

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonths(date, delta) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 0, 0, 0, 0));
}

function monthKeyUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function roundMoney(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function parseDurationMonths(text) {
  const explicitMonths = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (explicitMonths) return Math.max(1, Math.round(Number(explicitMonths[1])));
  const explicitWeeks = text.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (explicitWeeks) return Math.max(1, Math.round(Number(explicitWeeks[1]) / 4));
  const explicitDays = text.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (explicitDays) return Math.max(1, Math.round(Number(explicitDays[1]) / 30));
  if (/\bquarter\b/i.test(text)) return 3;
  if (/\bhalf[- ]?year\b/i.test(text)) return 6;
  if (/\byear\b/i.test(text)) return 12;
  return DEFAULT_DURATION_MONTHS;
}

function parseFrequency(text) {
  if (/\bdaily|every day|per day\b/i.test(text)) return 'daily';
  if (/\bweekly|every week|per week\b/i.test(text)) return 'weekly';
  if (/\bmonthly|every month|per month\b/i.test(text)) return 'monthly';
  return null;
}

function parseAmount(text) {
  const amountMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  return amountMatch ? Number(amountMatch[1]) : null;
}

function parsePercent(text) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const value = Number(m[1]);
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value)) / 100;
}

function parseDirection(text) {
  if (/\bskip|cut|reduce|save|less|stop|avoid\b/i.test(text)) return 'decrease_expense';
  if (/\bmore|increase|extra|spend more|add\b/i.test(text)) return 'increase_expense';
  return 'decrease_expense';
}

function parseCategory(text) {
  const cleaned = text.toLowerCase();
  const afterOn = cleaned.match(/(?:on|for|from)\s+([a-z][a-z &-]{1,30})/i);
  if (afterOn) return afterOn[1].trim();
  const skipWord = cleaned.match(/skip\s+([a-z][a-z &-]{1,30})/i);
  if (skipWord) return skipWord[1].trim();
  return null;
}

function perMonthFactor(frequency) {
  if (frequency === 'daily') return AVG_DAYS_IN_MONTH;
  if (frequency === 'weekly') return AVG_WEEKS_IN_MONTH;
  return 1;
}

function weightedAverage(values) {
  if (!values.length) return 0;
  let top = 0;
  let bottom = 0;
  for (let i = 0; i < values.length; i += 1) {
    const w = i + 1;
    top += values[i] * w;
    bottom += w;
  }
  return bottom ? top / bottom : 0;
}

function categoryMatch(txCategory, requested) {
  if (!requested) return false;
  const a = String(txCategory || '').trim().toLowerCase();
  const b = String(requested || '').trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

export async function runWhatIfSimulation(userId, promptText) {
  const prompt = String(promptText || '').trim();
  if (!prompt) {
    const err = new Error('Prompt is required');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const windowStart = addMonths(startOfMonth(now), -(MONTHS_BACK - 1));
  const windowEnd = now;

  const uid = new mongoose.Types.ObjectId(userId);
  const txs = await Transaction.find({
    userId: uid,
    date: { $gte: windowStart, $lte: windowEnd },
    type: { $in: ['income', 'expense'] },
  })
    .select('type amount category date')
    .lean();

  const months = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i -= 1) {
    months.push(monthKeyUTC(addMonths(startOfMonth(now), -i)));
  }

  const monthly = Object.fromEntries(months.map((m) => [m, { income: 0, expense: 0, catExpense: 0, catCount: 0 }]));
  const parsedCategory = parseCategory(prompt);

  for (const tx of txs) {
    const key = monthKeyUTC(new Date(tx.date));
    if (!monthly[key]) continue;
    if (tx.type === 'income') {
      monthly[key].income += Number(tx.amount) || 0;
    } else if (tx.type === 'expense') {
      monthly[key].expense += Number(tx.amount) || 0;
      if (parsedCategory && categoryMatch(tx.category, parsedCategory)) {
        monthly[key].catExpense += Number(tx.amount) || 0;
        monthly[key].catCount += 1;
      }
    }
  }

  const monthRows = months.map((m) => monthly[m]);
  const baselineIncome = weightedAverage(monthRows.map((r) => r.income));
  const baselineExpense = weightedAverage(monthRows.map((r) => r.expense));
  const baselineNet = baselineIncome - baselineExpense;

  const durationMonths = parseDurationMonths(prompt);
  let frequency = parseFrequency(prompt);
  const direction = parseDirection(prompt);
  const percent = parsePercent(prompt);
  let amount = parseAmount(prompt);

  const weightedCategoryMonthly = weightedAverage(monthRows.map((r) => r.catExpense));
  const weightedCategoryCount = weightedAverage(monthRows.map((r) => r.catCount));
  const categoryAvgAmount = weightedCategoryCount > 0 ? weightedCategoryMonthly / weightedCategoryCount : 0;

  if (!frequency) {
    if (weightedCategoryCount > 0) {
      const inferredPerMonth = Math.max(1, weightedCategoryCount);
      if (inferredPerMonth >= 20) frequency = 'daily';
      else if (inferredPerMonth >= 3) frequency = 'weekly';
      else frequency = 'monthly';
    } else {
      frequency = 'monthly';
    }
  }

  const freqFactor = perMonthFactor(frequency);

  if (amount == null && percent == null && parsedCategory && weightedCategoryMonthly > 0) {
    if (/skip|stop|avoid/i.test(prompt)) {
      amount = weightedCategoryMonthly / freqFactor;
    } else {
      amount = categoryAvgAmount || weightedCategoryMonthly / Math.max(1, freqFactor);
    }
  }

  if (amount == null && percent == null) {
    const err = new Error(
      'Could not detect amount or percentage. Try: "What if I reduce food by ₹200 daily for 3 months?"'
    );
    err.statusCode = 400;
    throw err;
  }

  let monthlySavings;
  if (percent != null) {
    const base = parsedCategory ? weightedCategoryMonthly : baselineExpense;
    monthlySavings = base * percent;
  } else {
    monthlySavings = (amount || 0) * freqFactor;
  }

  if (direction === 'increase_expense') {
    monthlySavings *= -1;
  }

  const projectedMonthlyNet = baselineNet + monthlySavings;
  const projectedTotalSavings = monthlySavings * durationMonths;

  let confidence = 0.85;
  if (amount == null && percent == null) confidence -= 0.25;
  if (!parsedCategory) confidence -= 0.15;
  if (weightedCategoryCount < 2) confidence -= 0.18;
  if (txs.length < 15) confidence -= 0.1;
  confidence = Math.max(0.45, Math.min(0.95, confidence));

  const spread = (1 - confidence) * Math.max(Math.abs(projectedTotalSavings), 500);
  const low = projectedTotalSavings - spread;
  const high = projectedTotalSavings + spread;

  const cardTone = projectedTotalSavings >= 0 ? 'positive' : 'negative';
  const netTone = projectedMonthlyNet >= baselineNet ? 'positive' : 'negative';

  return {
    prompt,
    parsed: {
      frequency,
      amount: amount != null ? roundMoney(amount) : null,
      percentage: percent != null ? roundMoney(percent * 100) : null,
      category: parsedCategory,
      durationMonths,
      direction,
    },
    baseline: {
      windowMonths: MONTHS_BACK,
      weightedMonthlyIncome: roundMoney(baselineIncome),
      weightedMonthlyExpense: roundMoney(baselineExpense),
      weightedMonthlyNet: roundMoney(baselineNet),
    },
    projection: {
      monthlySavings: roundMoney(monthlySavings),
      projectedMonthlyNet: roundMoney(projectedMonthlyNet),
      projectedTotalSavings: roundMoney(projectedTotalSavings),
      confidenceBand: {
        low: roundMoney(low),
        high: roundMoney(high),
        confidenceScore: roundMoney(confidence),
      },
    },
    impactCards: [
      {
        id: 'savings',
        title: `Projected savings (${durationMonths}m)`,
        value: roundMoney(projectedTotalSavings),
        tone: cardTone,
        subtitle: `${frequency} plan`,
      },
      {
        id: 'monthly-net',
        title: 'New monthly net',
        value: roundMoney(projectedMonthlyNet),
        tone: netTone,
        subtitle: `Baseline ${roundMoney(baselineNet)}`,
      },
      {
        id: 'confidence',
        title: 'Confidence band',
        value: {
          low: roundMoney(low),
          high: roundMoney(high),
        },
        tone: 'neutral',
        subtitle: `${Math.round(confidence * 100)}% confidence`,
      },
    ],
  };
}
