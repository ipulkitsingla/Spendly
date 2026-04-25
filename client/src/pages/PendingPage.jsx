import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatDay, formatMoney } from '../utils/format.js';
import EditPendingModal from '../components/EditPendingModal.jsx';

export default function PendingPage() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [err, setErr] = useState('');

  const [settling, setSettling] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAmountErr, setSettleAmountErr] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [p, a, cats] = await Promise.all([
      api.pending(),
      api.accounts(),
      api.categories(),
    ]);

    setItems(p);
    setAccounts(a);
    setCategories(cats);

    setAccountId((prev) =>
      prev && a.some((x) => String(x._id) === String(prev))
        ? prev
        : a[0]?._id || ''
    );
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  useEffect(() => {
    const h = () => load().catch((e) => setErr(e.message));
    window.addEventListener('spendly-sync-done', h);
    return () => window.removeEventListener('spendly-sync-done', h);
  }, [load]);

  const refresh = useCallback(
    () => load().catch((e) => setErr(e.message)),
    [load]
  );

  const pending = useMemo(
    () => items.filter((i) => i.status === 'pending'),
    [items]
  );

  const settled = useMemo(
    () => items.filter((i) => i.status === 'settled'),
    [items]
  );

  const totalPendingAmount = useMemo(
    () =>
      pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [pending]
  );

  const editingItem = useMemo(
    () =>
      pending.find((p) => String(p._id) === String(editing)) || null,
    [pending, editing]
  );

  const openSettle = (item) => {
    setSettling(item);
    setAccountId(accounts[0]?._id || '');
    setSettleAmount(String(item.amount));
    setSettleAmountErr('');
  };

  const closeSettle = () => {
    setSettling(null);
    setSettleAmount('');
    setSettleAmountErr('');
  };

  const doSettle = async (e) => {
    e.preventDefault();
    if (!settling || !accountId) return;

    const parsed = parseFloat(settleAmount);

    if (isNaN(parsed) || parsed <= 0) {
      setSettleAmountErr('Enter a valid amount greater than 0.');
      return;
    }

    if (parsed > settling.amount) {
      setSettleAmountErr(
        `Cannot exceed ${formatMoney(settling.amount)}`
      );
      return;
    }

    setSettleAmountErr('');
    setErr('');

    try {
      const isPartial = parsed < settling.amount;

      if (isPartial) {
        await api.settlePartialPending(
          settling._id,
          accountId,
          parsed
        );
      } else {
        await api.settlePending(settling._id, accountId);
      }

      closeSettle();
      await refresh();
    } catch (ex) {
      setErr(ex.message || 'Failed to settle');
    }
  };

  const settleAmountParsed = parseFloat(settleAmount) || 0;
  const isPartialSettle =
    settling &&
    settleAmountParsed > 0 &&
    settleAmountParsed < settling.amount;

  const remainingAfterSettle = settling
    ? Math.max(0, settling.amount - settleAmountParsed)
    : 0;

  return (
    <div className="pending-container animate-fade-in">
      <header className="page-header">
        <h1>Lent & Debts</h1>
      </header>

      <section className="pending-hero-compact card animate-fade-up">
        <div className="pending-hero-glow" />
        <div className="hero-compact-info">
          <p className="hero-compact-label">Total Outstanding</p>
          <h2 className="hero-compact-amount">{formatMoney(totalPendingAmount)}</h2>
        </div>
      </section>

      {err && <p className="error-msg" style={{ margin: '0 16px 16px' }}>{err}</p>}

      <div className="pending-content">
        <div className="section-title-row">
          <h3>Active Debts ({pending.length})</h3>
        </div>

        {pending.length === 0 ? (
          <div className="empty-state-mini card">
            <p>No active debts. Everyone's settled up! 🤝</p>
          </div>
        ) : (
          <div className="debt-list-compact">
            {pending.map((p) => (
              <div key={p._id} className="card debt-row-compact animate-fade-up">
                <div className="debt-avatar-sm">
                  {p.personName.charAt(0).toUpperCase()}
                </div>
                <div className="debt-info-mid">
                  <span className="debt-name-sm">{p.personName}</span>
                  <span className="debt-note-sm">{p.note || p.category}</span>
                </div>
                <div className="debt-end">
                  <div className="debt-amount-sm">{formatMoney(p.amount)}</div>
                  <div className="debt-row-actions">
                    <button type="button" className="btn-icon-sm btn-icon-primary" onClick={() => setEditing(p._id)} title="Edit">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button type="button" className="btn-icon-sm btn-icon-success" onClick={() => openSettle(p)} title="Settle">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {settled.length > 0 && (
          <>
            <div className="section-title-row" style={{ marginTop: 24 }}>
              <h3>Settled</h3>
            </div>
            <div className="settled-list-compact">
              {settled.slice(0, 5).map((p) => (
                <div key={p._id} className="settled-row-mini">
                  <span>{p.personName}</span>
                  <span className="settled-amt-mini">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {settling && (
        <div className="modal-backdrop" onClick={closeSettle}>
          <div className="modal animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Settle Repayment</h3>
              <button type="button" className="btn-close" onClick={closeSettle}>×</button>
            </div>
            
            <div className="settle-summary">
              <div className="settle-avatar">{settling.personName.charAt(0).toUpperCase()}</div>
              <div className="settle-desc">
                <strong>{settling.personName}</strong> owes you <span>{formatMoney(settling.amount)}</span>
              </div>
            </div>

            <form onSubmit={doSettle}>
              <div className="form-group">
                <label className="label">Amount to settle</label>
                <div className="input-group">
                  <input
                    autoFocus
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={settling.amount}
                    value={settleAmount}
                    onChange={(e) => {
                      setSettleAmount(e.target.value);
                      setSettleAmountErr('');
                    }}
                    placeholder={`Max ${formatMoney(settling.amount)}`}
                  />
                </div>
                {settleAmountErr && (
                  <p className="error-text">{settleAmountErr}</p>
                )}
              </div>

              {isPartialSettle && (
                <div className="partial-alert">
                  <div className="icon">💡</div>
                  <p>Partial settlement - <strong>{formatMoney(remainingAfterSettle)}</strong> will remain pending.</p>
                </div>
              )}

              <div className="form-group">
                <label className="label">Add to Account</label>
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeSettle}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {isPartialSettle ? 'Settle Partial' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingItem && (
        <EditPendingModal
          key={editingItem._id}
          item={editingItem}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
