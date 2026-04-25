import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api.js';
import {
  endOfMonth,
  endOfYear,
  formatMediumDate,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from '../utils/dates.js';
import { formatMoney } from '../utils/format.js';

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308'];

function rangeForPreset(preset, anchor = new Date()) {
  const now = anchor;
  if (preset === 'daily') {
    const to = now;
    const from = subDays(now, 13);
    return { from, to, bucket: 'day' };
  }
  if (preset === 'weekly') {
    const to = now;
    const from = subDays(now, 12 * 7);
    return { from, to, bucket: 'week' };
  }
  if (preset === 'monthly') {
    const from = startOfMonth(subMonths(now, 5));
    const to = endOfMonth(now);
    return { from, to, bucket: 'month' };
  }
  const from = startOfYear(now);
  const to = endOfYear(now);
  return { from, to, bucket: 'month' };
}

export default function StatsPage() {
  const [preset, setPreset] = useState('monthly');
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [err, setErr] = useState('');
  const [whatIfPrompt, setWhatIfPrompt] = useState('');
  const [whatIfResult, setWhatIfResult] = useState(null);
  const [whatIfErr, setWhatIfErr] = useState('');
  const [runningWhatIf, setRunningWhatIf] = useState(false);

  const { from, to, bucket } = useMemo(() => rangeForPreset(preset), [preset]);

  const load = useCallback(async () => {
    setErr('');
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const [sum, ts] = await Promise.all([
      api.statsSummary(fromIso, toIso),
      api.statsTimeseries(fromIso, toIso, bucket),
    ]);
    setSummary(sum);
    setSeries(ts);
  }, [from, to, bucket]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const pieData = useMemo(() => {
    if (!summary?.byCategory?.length) return [];
    return summary.byCategory
      .filter((c) => c.expense > 0)
      .map((c) => ({ name: c.name, value: c.expense }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [summary]);

  const runWhatIf = useCallback(async () => {
    const prompt = whatIfPrompt.trim();
    if (!prompt) return;
    setWhatIfErr('');
    setRunningWhatIf(true);
    try {
      const data = await api.runWhatIf(prompt);
      setWhatIfResult(data);
    } catch (e) {
      setWhatIfErr(e.message || 'Could not run simulation');
    } finally {
      setRunningWhatIf(false);
    }
  }, [whatIfPrompt]);

  return (
    <>
      <header className="page-header">
        <h1>Statistics</h1>
      </header>

      <div className="pill-row">
        {[
          ['daily', 'Daily'],
          ['weekly', 'Weekly'],
          ['monthly', 'Monthly'],
          ['yearly', 'Yearly'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pill ${preset === id ? 'active' : ''}`}
            onClick={() => setPreset(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <p style={{ padding: '0 16px', color: 'var(--muted)', fontSize: '0.85rem', marginTop: 0 }}>
        {formatMediumDate(from)} — {formatMediumDate(to)}
      </p>

      {err && <p style={{ color: 'var(--expense)', padding: '0 16px' }}>{err}</p>}

      {summary && (
        <div className="summary-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat">
            <span>Total income</span>
            <strong className="type-income">{formatMoney(summary.totalIncome)}</strong>
          </div>
          <div className="stat">
            <span>Total expenses</span>
            <strong className="type-expense">{formatMoney(summary.totalExpense)}</strong>
          </div>
          <div className="stat">
            <span>Net</span>
            <strong>{formatMoney(summary.net)}</strong>
          </div>
        </div>
      )}

      <section className="card" style={{ margin: '0 16px 18px' }}>
        <strong>What If Simulator</strong>
        <p style={{ margin: '8px 0 12px', color: 'var(--muted)', fontSize: '0.85rem' }}>
          Try: What if I skip coffee for 3 months?
        </p>
        <textarea
          className="input"
          rows={3}
          value={whatIfPrompt}
          onChange={(e) => setWhatIfPrompt(e.target.value)}
          placeholder="What if I reduce food spending by ₹200 daily for 3 months?"
          style={{ resize: 'vertical', minHeight: 84 }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button type="button" className="btn btn-primary" disabled={runningWhatIf} onClick={runWhatIf}>
            {runningWhatIf ? 'Simulating…' : 'Run Simulation'}
          </button>
        </div>
        {whatIfErr && <p style={{ color: 'var(--expense)', marginTop: 10 }}>{whatIfErr}</p>}
        {whatIfResult?.impactCards?.length > 0 && (
          <div className="summary-strip summary-strip--three" style={{ margin: '14px 0 0' }}>
            {whatIfResult.impactCards.map((card) => {
              const toneClass =
                card.tone === 'positive' ? 'type-income' : card.tone === 'negative' ? 'type-expense' : '';
              const val =
                card.id === 'confidence'
                  ? `${formatMoney(card.value.low)} to ${formatMoney(card.value.high)}`
                  : formatMoney(card.value);
              return (
                <div key={card.id} className="stat">
                  <span>{card.title}</span>
                  <strong className={toneClass}>{val}</strong>
                  <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: '0.76rem' }}>{card.subtitle}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="charts-grid">
        <div className="card" style={{ minHeight: 280 }}>
          <strong>Income vs expense</strong>
          <div style={{ width: '100%', height: 220, marginTop: 12 }}>
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151' }}
                  formatter={(v) => formatMoney(v)}
                />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" name="Income" />
                <Bar dataKey="expense" fill="#ef4444" name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ minHeight: 280 }}>
          <strong>Expense by category</strong>
          {pieData.length === 0 ? (
            <p className="empty" style={{ padding: '24px 0' }}>
              No expense data in this range.
            </p>
          ) : (
            <div style={{ width: '100%', height: 240, marginTop: 12 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
