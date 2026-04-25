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
  Area,
  AreaChart,
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

const COLORS = [
  '#6366f1', // Indigo
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
];

function rangeForPreset(preset, anchor = new Date()) {
  const now = new Date(anchor);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (preset === 'daily') {
    return { from: startOfToday, to: endOfToday, bucket: 'day' };
  }
  if (preset === 'weekly') {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 6); // Last 7 days
    return { from, to: endOfToday, bucket: 'day' };
  }
  if (preset === 'monthly') {
    const from = startOfMonth(now);
    const to = endOfMonth(now);
    return { from, to, bucket: 'day' };
  }
  if (preset === 'yearly') {
    const from = startOfYear(now);
    const to = endOfYear(now);
    return { from, to, bucket: 'month' };
  }
  return { from: startOfToday, to: endOfToday, bucket: 'day' };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-chart-tooltip">
        <p className="tooltip-label">{label}</p>
        <div className="tooltip-items">
          {payload.map((entry, index) => (
            <div key={index} className="tooltip-item">
              <span className="dot" style={{ backgroundColor: entry.color }} />
              <span className="name">{entry.name}:</span>
              <span className="value">{formatMoney(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function StatsPage() {
  const [preset, setPreset] = useState('monthly');
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [err, setErr] = useState('');

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

  const topCategory = pieData[0] || null;
  const daysInRange = Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
  const dailyAvg = summary ? summary.totalExpense / daysInRange : 0;

  return (
    <div className="stats-container animate-fade-up">
      <header className="page-header">
        <h1>Insights</h1>
      </header>

      <div className="stats-controls">
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
        <p className="stats-date-range">
          {formatMediumDate(from)} — {formatMediumDate(to)}
        </p>
      </div>

      {err && <p className="error-text">{err}</p>}

      <div className="stats-overview-grid">
        <div className="card stat-card">
          <span className="label">Total Income</span>
          <strong className="value type-income">{formatMoney(summary?.totalIncome || 0)}</strong>
        </div>
        <div className="card stat-card">
          <span className="label">Total Expenses</span>
          <strong className="value type-expense">{formatMoney(summary?.totalExpense || 0)}</strong>
        </div>
        <div className="card stat-card">
          <span className="label">Net Balance</span>
          <strong className="value">{formatMoney(summary?.net || 0)}</strong>
        </div>
      </div>

      <div className="stats-insights-grid">
        <div className="card insight-card">
          <div className="insight-icon">🔥</div>
          <div className="insight-body">
            <span className="label">Top Category</span>
            <strong className="value">{topCategory ? topCategory.name : 'N/A'}</strong>
            {topCategory && <span className="sub">{formatMoney(topCategory.value)} spent</span>}
          </div>
        </div>
        <div className="card insight-card">
          <div className="insight-icon">📅</div>
          <div className="insight-body">
            <span className="label">Daily Average</span>
            <strong className="value">{formatMoney(dailyAvg)}</strong>
            <span className="sub">Over {daysInRange} days</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card chart-card">
          <div className="chart-header">
            <strong>Category Split</strong>
            <span className="sub">Top expenses by category</span>
          </div>
          {pieData.length === 0 ? (
            <p className="empty">No expense data available.</p>
          ) : (
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    dataKey="value" 
                    nameKey="name" 
                    innerRadius="65%"
                    outerRadius="90%"
                    paddingAngle={5}
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} cornerRadius={4} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, color: 'var(--muted)', paddingTop: 20 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
