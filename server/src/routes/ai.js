import { Router } from 'express';
import mongoose from 'mongoose';
import { authRequired } from '../middleware/auth.js';
import AiChatMessage from '../models/AiChatMessage.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import User from '../models/User.js';
import PendingTransaction from '../models/PendingTransaction.js';
import { runWhatIfSimulation } from '../services/whatIfSimulator.js';
import { recalculateAllBalances, NegativeBalanceError, negativeBalanceMessage } from '../services/recalculateBalances.js';

const router = Router();
router.use(authRequired);

const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const CHAT_HISTORY_LIMIT = 40;
const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-pro',
];

function resolveAiProvider() {
  const explicit = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'gemini' || explicit === 'openai') return explicit;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'openai';
}

function normalizeGeminiModelName(model) {
  const cleaned = String(model || '').trim();
  if (!cleaned) return 'gemini-2.5-flash';
  return cleaned.startsWith('models/') ? cleaned.slice('models/'.length) : cleaned;
}

function cleanText(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoneyAmount(prompt) {
  const m = String(prompt || '').match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isNaN(n) ? null : n;
}

function detectAccountPhrase(prompt) {
  const p = String(prompt || '').toLowerCase();
  const byAccountWord = p.match(/\b([a-z][a-z0-9 &-]{1,40})\s+account\b/i);
  if (byAccountWord) return byAccountWord[1].trim();
  const via = p.match(/\b(?:in|from|using|via)\s+([a-z][a-z0-9 &-]{1,40})\b/i);
  if (via) return via[1].trim();
  return '';
}

function inferTxType(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (/\b(income|received|salary|earned|credit)\b/.test(p)) return 'income';
  if (/\b(transfer|move)\b/.test(p)) return 'transfer';
  if (/\b(expense|spent|spend|paid|pay|debit|log)\b/.test(p)) return 'expense';
  return null;
}

function pickBestAccount(accounts, phrase) {
  const needle = cleanText(phrase);
  if (!needle) return null;
  let best = null;
  let score = 0;
  for (const acc of accounts) {
    const name = cleanText(acc.name);
    if (!name) continue;
    let s = 0;
    if (name === needle) s += 10;
    if (name.includes(needle) || needle.includes(name)) s += 6;
    for (const t of needle.split(' ')) {
      if (t.length >= 2 && name.includes(t)) s += 1;
    }
    if (s > score) {
      score = s;
      best = acc;
    }
  }
  return score >= 2 ? best : null;
}

function parseActionRequest(prompt) {
  const p = String(prompt || '').trim();
  const lower = p.toLowerCase();

  const deleteCat =
    p.match(/\b(?:remove|delete)\s+(?:the\s+)?category\s+([a-z][a-z0-9 &-]{1,40})\b/i) ||
    p.match(/\b(?:remove|delete)\s+([a-z][a-z0-9 &-]{1,40})\s+category\b/i);
  if (deleteCat) {
    return { type: 'delete_category', category: deleteCat[1].trim(), raw: p };
  }

  const addCat =
    p.match(/\b(?:add|create)\s+(?:a\s+)?category\s+([a-z][a-z0-9 &-]{1,40})\b/i) ||
    p.match(/\b(?:add|create)\s+([a-z][a-z0-9 &-]{1,40})\s+category\b/i);
  if (addCat) {
    return { type: 'add_category', category: addCat[1].trim(), raw: p };
  }

  const intentPrefix = /\b(log|add|record|create)\b/.test(lower);
  const type = inferTxType(lower);
  const amount = parseMoneyAmount(p);
  if (!intentPrefix || !type || amount == null) return null;

  const category =
    p.match(/\b(?:for|on)\s+([a-z][a-z0-9 &-]{1,40})\b(?:\s+(?:from|using|via|in|to)\b|$)/i)?.[1]?.trim() ||
    (type === 'income' ? 'Income' : 'Other');
  const fromPhrase = p.match(/\b(?:from|using|via|in)\s+([a-z][a-z0-9 &-]{1,40})/i)?.[1]?.trim() || '';
  const toPhrase = p.match(/\bto\s+([a-z][a-z0-9 &-]{1,40})/i)?.[1]?.trim() || '';
  return { type, amount, category, fromPhrase, toPhrase, raw: p };
}

async function executeChatAction(userId, prompt) {
  const parsed = parseActionRequest(prompt);
  if (!parsed) return null;

  if (parsed.type === 'delete_category' || parsed.type === 'add_category') {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const normalized = String(parsed.category || '').trim();
    const existing = user.categories.find((c) => c.name.toLowerCase() === normalized.toLowerCase());

    if (parsed.type === 'add_category') {
      if (existing) {
        return {
          action: 'category_exists',
          payload: { name: existing.name },
          userReply: `Category "${existing.name}" already exists.`,
        };
      }
      user.categories.push({ name: normalized, isCustom: true });
      await user.save();
      return {
        action: 'category_added',
        payload: { name: normalized },
        userReply: `Done. Added category "${normalized}".`,
      };
    }

    if (!existing) {
      return {
        action: 'category_not_found',
        payload: { name: normalized },
        userReply: `I could not find category "${normalized}".`,
      };
    }
    if (!existing.isCustom) {
      return {
        action: 'category_protected',
        payload: { name: existing.name },
        userReply: `Cannot remove "${existing.name}" because it is a default category.`,
      };
    }
    user.categories = user.categories.filter((c) => c.name.toLowerCase() !== normalized.toLowerCase());
    await user.save();
    return {
      action: 'category_deleted',
      payload: { name: existing.name },
      userReply: `Done. Removed category "${existing.name}".`,
    };
  }

  const accounts = await Account.find({ userId }).lean();
  if (!accounts.length) {
    const err = new Error('No account found. Create an account first.');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(userId).select('categories').lean();
  const userCategories = (user?.categories || []).map((c) => String(c.name || '').toLowerCase());
  const normalizedCategory = String(parsed.category || '').trim();
  const category =
    userCategories.find((c) => c === normalizedCategory.toLowerCase()) ?
      user.categories.find((c) => c.name.toLowerCase() === normalizedCategory.toLowerCase()).name :
      normalizedCategory;

  if (parsed.type === 'transfer') {
    const from = pickBestAccount(accounts, parsed.fromPhrase) || accounts[0];
    const to = pickBestAccount(accounts, parsed.toPhrase) || accounts.find((a) => String(a._id) !== String(from._id));
    if (!to) {
      const err = new Error('Need two different accounts for transfer.');
      err.statusCode = 400;
      throw err;
    }
    const tx = await Transaction.create({
      userId,
      type: 'transfer',
      amount: parsed.amount,
      category: category || 'Transfer',
      fromAccountId: from._id,
      toAccountId: to._id,
      date: new Date(),
      note: parsed.raw,
      balanceAfterTransaction: 0,
      toBalanceAfterTransaction: 0,
      balanceAccountId: from._id,
    });
    await recalculateAllBalances(userId);
    return {
      action: 'transaction_created',
      payload: {
        txId: tx._id,
        type: 'transfer',
        amount: parsed.amount,
        fromAccount: from.name,
        toAccount: to.name,
      },
      userReply: `Done. Logged transfer of ₹${parsed.amount} from ${from.name} to ${to.name}.`,
    };
  }

  const account = pickBestAccount(accounts, parsed.fromPhrase) || accounts[0];
  const tx = await Transaction.create({
    userId,
    type: parsed.type,
    amount: parsed.amount,
    category: category || (parsed.type === 'income' ? 'Income' : 'Other'),
    accountId: account._id,
    date: new Date(),
    note: parsed.raw,
    balanceAfterTransaction: 0,
    balanceAccountId: account._id,
  });
  try {
    await recalculateAllBalances(userId);
  } catch (e) {
    await Transaction.deleteOne({ _id: tx._id });
    if (e instanceof NegativeBalanceError) {
      const err = new Error(negativeBalanceMessage(e));
      err.statusCode = 400;
      throw err;
    }
    throw e;
  }
  return {
    action: 'transaction_created',
    payload: {
      txId: tx._id,
      type: parsed.type,
      amount: parsed.amount,
      category: category || (parsed.type === 'income' ? 'Income' : 'Other'),
      account: account.name,
    },
    userReply: `Done. Logged ${parsed.type} of ₹${parsed.amount} for ${category || 'Other'} from ${account.name}.`,
  };
}

function isoMonthRange(offsetMonths = 0) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1, 0, 0, 0, 0));
  const start = base;
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

async function summaryForRange(userId, fromDate, toDate) {
  const uid = new mongoose.Types.ObjectId(userId);
  const txs = await Transaction.find({
    userId: uid,
    date: { $gte: fromDate, $lt: toDate },
    type: { $in: ['income', 'expense'] },
  })
    .select('type amount category')
    .lean();

  let income = 0;
  let expense = 0;
  const categoryExpense = {};
  for (const tx of txs) {
    if (tx.type === 'income') income += Number(tx.amount) || 0;
    if (tx.type === 'expense') {
      expense += Number(tx.amount) || 0;
      categoryExpense[tx.category] = (categoryExpense[tx.category] || 0) + (Number(tx.amount) || 0);
    }
  }
  const topCategory = Object.entries(categoryExpense).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    income,
    expense,
    net: income - expense,
    topExpenseCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
  };
}

async function debtSettlementProjection(userId) {
  const [accounts, pending] = await Promise.all([
    Account.find({ userId }).select('name balance').lean(),
    PendingTransaction.find({ userId, status: 'pending' }).select('personName amount category').lean(),
  ]);
  const currentBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const totalPendingDebt = pending.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return {
    currentBalance,
    totalPendingDebt,
    projectedBalanceIfSettled: currentBalance + totalPendingDebt,
    pendingCount: pending.length,
    accounts: accounts.map((a) => ({ name: a.name, balance: Number(a.balance) || 0 })),
    pendingDebts: pending.map((p) => ({
      personName: p.personName,
      amount: Number(p.amount) || 0,
      category: p.category,
    })),
  };
}

async function debtSettlementForSpecificAccount(userId, prompt) {
  const [accounts, pending] = await Promise.all([
    Account.find({ userId }).select('name balance').lean(),
    PendingTransaction.find({ userId, status: 'pending' }).select('amount').lean(),
  ]);
  if (!accounts.length) return null;
  const phrase = detectAccountPhrase(prompt);
  const matched = phrase ? pickBestAccount(accounts, phrase) : null;
  if (!matched) return null;
  const pendingTotal = pending.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return {
    requestedAccount: phrase,
    matchedAccount: {
      name: matched.name,
      currentBalance: Number(matched.balance) || 0,
      projectedIfAllDebtsSettledIntoThisAccount: (Number(matched.balance) || 0) + pendingTotal,
    },
    pendingDebtTotal: pendingTotal,
    pendingCount: pending.length,
  };
}

async function accountBalanceProjection(userId, prompt) {
  const accounts = await Account.find({ userId }).select('name balance').lean();
  if (!accounts.length) return null;
  const phrase = detectAccountPhrase(prompt);
  const account = phrase ? pickBestAccount(accounts, phrase) : null;
  const total = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  return {
    requestedAccount: phrase || null,
    matchedAccount: account ? { name: account.name, balance: Number(account.balance) || 0 } : null,
    totalBalance: total,
    accounts: accounts.map((a) => ({ name: a.name, balance: Number(a.balance) || 0 })),
  };
}

function detectCategoryHint(prompt) {
  const p = String(prompt || '').toLowerCase();
  const known = [
    'food',
    'travel',
    'shopping',
    'entertainment',
    'health',
    'transport',
    'bills',
    'salary',
    'debt',
    'other',
  ];
  for (const k of known) {
    if (new RegExp(`\\b${k}\\b`, 'i').test(p)) return k;
  }
  const explicit = p.match(/category\s+([a-z][a-z0-9 &-]{1,30})/i);
  return explicit?.[1]?.trim() || null;
}

async function categoryExpenseForRange(userId, fromDate, toDate, categoryHint) {
  const uid = new mongoose.Types.ObjectId(userId);
  const txs = await Transaction.find({
    userId: uid,
    date: { $gte: fromDate, $lt: toDate },
    type: 'expense',
  })
    .select('amount category')
    .lean();

  const wanted = String(categoryHint || '').trim().toLowerCase();
  let total = 0;
  let count = 0;
  for (const tx of txs) {
    const c = String(tx.category || '').trim().toLowerCase();
    if (!wanted) continue;
    if (c === wanted || c.includes(wanted) || wanted.includes(c)) {
      total += Number(tx.amount) || 0;
      count += 1;
    }
  }
  return { total, count };
}

async function buildToolContext(userId, prompt) {
  const p = String(prompt || '').toLowerCase();
  const tool = { name: null, payload: null };

  if (/\b(balance|bank balance|account balance|how much.*account)\b/.test(p)) {
    const projection = await accountBalanceProjection(userId, prompt);
    if (projection) {
      tool.name = 'account_balance_lookup';
      tool.payload = projection;
      return tool;
    }
  }

  if (
    /\b(balance|net worth|worth)\b/.test(p) &&
    /\b(debt|pending|lend|lent)\b/.test(p) &&
    /\b(settle|settled|clear|repaid|repay|paid back|pay back|if all)\b/.test(p)
  ) {
    const accountProjection = await debtSettlementForSpecificAccount(userId, prompt);
    if (accountProjection) {
      tool.name = 'debt_settlement_account_projection';
      tool.payload = accountProjection;
      return tool;
    }
    const projection = await debtSettlementProjection(userId);
    tool.name = 'debt_settlement_projection';
    tool.payload = projection;
    return tool;
  }

  const weekMatch = p.match(/\blast\s+(\d{1,2})\s+weeks?\b/i);
  if (weekMatch) {
    const weeks = Math.max(1, Math.min(12, Number(weekMatch[1]) || 2));
    const days = weeks * 7;
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);
    const previousEnd = currentStart;
    const categoryHint = detectCategoryHint(prompt);

    const [currentSummary, previousSummary] = await Promise.all([
      summaryForRange(userId, currentStart, now),
      summaryForRange(userId, previousStart, previousEnd),
    ]);

    const [currentCat, previousCat] = await Promise.all([
      categoryExpenseForRange(userId, currentStart, now, categoryHint),
      categoryExpenseForRange(userId, previousStart, previousEnd, categoryHint),
    ]);

    tool.name = 'weeks_compare';
    tool.payload = {
      weeks,
      category: categoryHint,
      currentRange: {
        from: currentStart.toISOString(),
        to: now.toISOString(),
        summary: currentSummary,
        categoryExpense: currentCat,
      },
      previousRange: {
        from: previousStart.toISOString(),
        to: previousEnd.toISOString(),
        summary: previousSummary,
        categoryExpense: previousCat,
      },
      deltas: {
        expense: currentSummary.expense - previousSummary.expense,
        income: currentSummary.income - previousSummary.income,
        net: currentSummary.net - previousSummary.net,
        categoryExpense: currentCat.total - previousCat.total,
      },
    };
    return tool;
  }

  if (/\bwhat if|what-if|if i\b/.test(p)) {
    const whatIf = await runWhatIfSimulation(userId, prompt);
    tool.name = 'what_if_simulation';
    tool.payload = whatIf;
    return tool;
  }

  if (/\b(last month|this month|compare|vs|versus)\b/.test(p)) {
    const thisMonth = isoMonthRange(0);
    const lastMonth = isoMonthRange(-1);
    const [thisSummary, lastSummary] = await Promise.all([
      summaryForRange(userId, thisMonth.start, thisMonth.end),
      summaryForRange(userId, lastMonth.start, lastMonth.end),
    ]);
    tool.name = 'month_compare';
    tool.payload = {
      thisMonth: thisSummary,
      lastMonth: lastSummary,
      deltaExpense: thisSummary.expense - lastSummary.expense,
      deltaIncome: thisSummary.income - lastSummary.income,
      deltaNet: thisSummary.net - lastSummary.net,
    };
    return tool;
  }

  if (/\b(spent|spend|expense|expenses|category|food|travel|shopping|budget)\b/.test(p)) {
    const thisMonth = isoMonthRange(0);
    const summary = await summaryForRange(userId, thisMonth.start, thisMonth.end);
    tool.name = 'current_month_summary';
    tool.payload = summary;
    return tool;
  }

  return tool;
}

async function callAi(messages) {
  const provider = resolveAiProvider();
  if (provider === 'gemini') {
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!geminiApiKey) {
      const err = new Error('GEMINI_API_KEY is not configured on server');
      err.statusCode = 503;
      throw err;
    }

    const systemMessages = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const conversation = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const preferred = normalizeGeminiModelName(GEMINI_MODEL);
    const modelsToTry = [preferred, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== preferred)];
    let lastError = null;

    for (const modelName of modelsToTry) {
      const url = `${GEMINI_BASE_URL}/models/${encodeURIComponent(modelName)}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          ...(systemMessages ? { system_instruction: { parts: [{ text: systemMessages }] } } : {}),
          contents: conversation,
          generationConfig: { temperature: 0.3 },
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const message = data?.error?.message || 'Gemini API request failed';
        lastError = { status: res.status, message };
        const notFoundModel =
          res.status === 404 || /not found|not supported|unsupported for generatecontent/i.test(String(message));
        if (notFoundModel) continue;
        const err = new Error(message);
        err.statusCode = res.status;
        throw err;
      }

      const answer =
        data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n').trim() ||
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return answer || 'I could not generate a response.';
    }

    const err = new Error(lastError?.message || 'No compatible Gemini model was available for this API key.');
    err.statusCode = lastError?.status || 503;
    throw err;
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI_API_KEY is not configured on server');
    err.statusCode = 503;
    throw err;
  }

  const res = await fetch(AI_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.3,
      messages,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || 'AI API request failed');
    err.statusCode = res.status;
    throw err;
  }

  return data?.choices?.[0]?.message?.content?.trim() || 'I could not generate a response.';
}

router.post('/chat', async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ message: 'prompt is required' });

    const actionResult = await executeChatAction(req.userId, prompt);
    if (actionResult) {
      await AiChatMessage.create([
        { userId: req.userId, role: 'user', content: prompt.slice(0, 4000) },
        { userId: req.userId, role: 'assistant', content: actionResult.userReply.slice(0, 4000) },
      ]);
      return res.json({ reply: actionResult.userReply, toolUsed: actionResult.action, action: actionResult.payload });
    }

    const persistedHistoryDesc = await AiChatMessage.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(CHAT_HISTORY_LIMIT)
      .lean();
    const persistedHistory = [...persistedHistoryDesc].reverse();

    const toolContext = await buildToolContext(req.userId, prompt);
    const toolMessage = toolContext?.name
      ? {
          role: 'system',
          content: `Tool context (${toolContext.name}): ${JSON.stringify(toolContext.payload)}`,
        }
      : null;

    const system = {
      role: 'system',
      content:
        'You are SPENDI, a personal finance AI assistant inside Spendly. Be concise, actionable, and safe. Help with budgeting, spending analysis, saving strategies, debt payoff, and app usage. Use tool context when provided. For account_balance_lookup, prefer matchedAccount balance when available; mention totalBalance only as secondary context. For debt_settlement_account_projection, directly answer with the projected account balance if all pending debts settle into that matched account. Use Indian currency formatting by default and show money with the rupee symbol (₹). If asked non-finance questions, still answer helpfully.',
    };

    const safeHistory = persistedHistory
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const messages = [system, ...(toolMessage ? [toolMessage] : []), ...safeHistory, { role: 'user', content: prompt }];
    const reply = await callAi(messages);

    await AiChatMessage.create([
      { userId: req.userId, role: 'user', content: prompt.slice(0, 4000) },
      { userId: req.userId, role: 'assistant', content: reply.slice(0, 4000) },
    ]);

    res.json({ reply, toolUsed: toolContext?.name || null });
  } catch (err) {
    const code = err.statusCode || 500;
    res.status(code).json({ message: err.message || 'SPENDI failed to respond' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const rowsDesc = await AiChatMessage.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(CHAT_HISTORY_LIMIT)
      .lean();
    const rows = [...rowsDesc].reverse();
    res.json(
      rows.map((r) => ({
        role: r.role,
        content: r.content,
        createdAt: r.createdAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Failed to load AI chat history' });
  }
});

router.delete('/history', async (req, res) => {
  try {
    await AiChatMessage.deleteMany({ userId: req.userId });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Failed to clear AI chat history' });
  }
});

export default router;
