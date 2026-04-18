import { useCallback, useEffect, useState } from 'react';
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
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const [p, a, cats] = await Promise.all([api.pending(), api.accounts(), api.categories()]);
    setItems(p);
    setAccounts(a);
    setCategories(cats);
    setAccountId((prev) => (prev && a.some((x) => x._id === prev) ? prev : a[0]?._id || ''));
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  const refresh = () => load().catch((e) => setErr(e.message));

  const doSettle = async (e) => {
    e.preventDefault();
    if (!settling || !accountId) return;
    setErr('');
    try {
      await api.settlePending(settling, accountId);
      setSettling(null);
      await refresh();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const pending = items.filter((i) => i.status === 'pending');
  const settled = items.filter((i) => i.status === 'settled');

  const editingItem = editing ? pending.find((p) => p._id === editing) : null;

  return (
    <>
      <header className="page-header">
        <h1>Pending / debts</h1>
      </header>

      <p style={{ padding: '0 16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
        Track money you lent. Balances stay unchanged until you mark a repayment as settled — then it posts as
        income to the account you choose. Tap a pending row to edit.
      </p>

      {err && <p style={{ color: 'var(--expense)', padding: '0 16px' }}>{err}</p>}

      <h2 style={{ padding: '0 16px', fontSize: '1rem', color: 'var(--pending)' }}>Pending</h2>
      {pending.length === 0 ? (
        <p className="empty">No pending debts. Use the + button on Home to add one.</p>
      ) : (
        <ul className="tx-list">
          {pending.map((p) => (
            <li key={p._id} className="tx-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <button
                type="button"
                onClick={() => setEditing(p._id)}
                style={{
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  padding: 0,
                  cursor: 'pointer',
                  gridColumn: '1',
                }}
              >
                <div className="tx-title">{p.personName}</div>
                <div className="tx-meta">
                  {formatDay(p.date)} · {p.category}
                  {p.note ? ` · ${p.note}` : ''}
                </div>
              </button>
              <div style={{ textAlign: 'right' }}>
                <div className="tx-amount" style={{ color: 'var(--pending)' }}>
                  {formatMoney(p.amount)}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    onClick={() => setEditing(p._id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                    onClick={() => {
                      setSettling(p._id);
                      setAccountId(accounts[0]?._id || '');
                    }}
                  >
                    Settle
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ padding: '16px 16px 0', fontSize: '1rem', color: 'var(--muted)' }}>Settled</h2>
      {settled.length === 0 ? (
        <p className="empty" style={{ paddingTop: 16 }}>
          No settled records yet.
        </p>
      ) : (
        <ul className="tx-list">
          {settled.map((p) => (
            <li key={p._id} className="tx-row">
              <div>
                <div className="tx-title">{p.personName}</div>
                <div className="tx-meta">
                  {formatDay(p.date)} · {p.category}
                </div>
              </div>
              <div className="tx-amount" style={{ color: 'var(--pending-muted)' }}>
                {formatMoney(p.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {settling && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSettling(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Settle repayment</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
              Record income for this repayment into:
            </p>
            <form onSubmit={doSettle}>
              <div className="field">
                <label className="label">Account</label>
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setSettling(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm
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
    </>
  );
}
