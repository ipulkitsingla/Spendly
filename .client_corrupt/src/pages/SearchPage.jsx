import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDay, formatGroupDate, formatMoney } from '../utils/format.js';
import SwipeableRow from '../components/SwipeableRow.jsx';
import EditTransactionModal from '../components/EditTransactionModal.jsx';

function groupTxsByDate(txs) {
  const groups = {};
  txs.forEach((tx) => {
    const date = tx.date.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [accountId, setAccountId] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editTx, setEditTx] = useState(null);

  const loadMeta = useCallback(async () => {
    try {
      const [accs, cats] = await Promise.all([api.accounts(), api.categories()]);
      setAccounts(accs || []);
      setCategories(cats || []);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const performSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const txs = await api.searchTransactions({ q, start, end, min, max, accountId });
      setResults(txs || []);
    } catch (ex) {
      setErr(ex.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, start, end, min, max, accountId]);

  const deleteTx = useCallback(async (tx) => {
    if (!window.confirm('Delete this transaction? Balances will be recalculated.')) return;
    setErr('');
    try {
      await api.deleteTransaction(tx._id);
      await performSearch();
    } catch (e) {
      setErr(e.message);
    }
  }, [performSearch]);

  const editTxNormalized = editTx
    ? {
        ...editTx,
        accountId: editTx.accountId ? String(editTx.accountId) : '',
        fromAccountId: editTx.fromAccountId ? String(editTx.fromAccountId) : '',
        toAccountId: editTx.toAccountId ? String(editTx.toAccountId) : '',
      }
    : null;

  const txGroups = useMemo(() => {
    if (!results.length) return [];
    return groupTxsByDate(results);
  }, [results]);

  return (
    <>
      <div className="card" style={{ margin: '16px', padding: '16px' }}>
        <form onSubmit={performSearch}>
          <div className="field">
            <label className="label">Search Keyword</label>
            <input
              type="text"
              className="input"
              placeholder="Search by note, category..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          
          {showAdvanced && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label className="label">Min Amount (₹)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: 1, margin: 0 }}>
                  <label className="label">Max Amount (₹)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="9999"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Account</label>
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">All Accounts</option>
                  {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide Filters' : 'Advanced Filters'}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
        {err && <p style={{ color: 'var(--expense)', marginTop: '12px', fontSize: '0.9rem' }}>{err}</p>}
      </div>

      <div style={{ paddingBottom: '88px', padding: '0 16px' }}>
        {results.length === 0 && !loading && (
          <p className="empty">No results found. Adjust your search filters.</p>
        )}
        {txGroups.map(([date, dayTxs]) => (
          <div key={date} className="tx-group-card animate-fade-up">
            <div className="tx-group-header">
              <span className="tx-group-date">{formatGroupDate(date)}</span>
              <span className="tx-group-count">
                {dayTxs.length} {dayTxs.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {dayTxs.map((tx) => {
                const isExpense = tx.type === 'expense';
                const isIncome = tx.type === 'income';
                const isBalUpdate = tx.type === 'balance_update';

                let signPrefix = '';
                let amtCls = '';
                let iconCls = '';
                let showAbs = Math.abs(Number(tx.amount));

                if (isExpense) {
                  signPrefix = '−';
                  amtCls = 'expense';
                  iconCls = 'expense';
                } else if (isIncome) {
                  signPrefix = '+';
                  amtCls = 'income';
                  iconCls = 'income';
                } else if (isBalUpdate) {
                  const d = Number(tx.amount);
                  signPrefix = d >= 0 ? '+' : '−';
                  amtCls = d >= 0 ? 'income' : 'expense';
                  iconCls = 'balance-update';
                } else {
                  iconCls = 'transfer';
                }

                const subtitle = `${tx.note || tx.category} · ${formatDay(tx.date)}`;

                return (
                  <li key={tx._id}>
                    <SwipeableRow onEdit={() => setEditTx(tx)} onDelete={() => deleteTx(tx)}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="tx-row-v3"
                        onClick={() => setEditTx(tx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setEditTx(tx);
                          }
                        }}
                      >
                        <div className={`tx-icon-circle ${iconCls}`}>
                          {isIncome ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 7l10 10M17 7v10H7" transform="rotate(180 12 12)" />
                            </svg>
                          ) : isExpense ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 7l10 10M17 7v10H7" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 3L21 8L16 13" />
                              <path d="M21 8H3" />
                            </svg>
                          )}
                        </div>
                        <div className="tx-v3-body">
                          <div className="tx-v3-title">{tx.category}</div>
                          <div className="tx-v3-subtitle">{subtitle}</div>
                        </div>
                        <div className={`tx-v3-amt ${amtCls}`}>
                          {signPrefix}
                          {formatMoney(showAbs)}
                        </div>
                      </div>
                    </SwipeableRow>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {editTxNormalized && (
        <EditTransactionModal
          key={editTxNormalized._id}
          tx={editTxNormalized}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditTx(null)}
          onSaved={performSearch}
        />
      )}
    </>
  );
}
