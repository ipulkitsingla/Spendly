import { useCallback, useEffect, useState } from ‘react’;
import { api } from ‘../api.js’;
import { formatDay, formatMoney } from ‘../utils/format.js’;
import EditPendingModal from ‘../components/EditPendingModal.jsx’;

export default function PendingPage() {
const [items, setItems] = useState([]);
const [accounts, setAccounts] = useState([]);
const [categories, setCategories] = useState([]);
const [err, setErr] = useState(’’);
const [settling, setSettling] = useState(null); // { id, amount (full) }
const [accountId, setAccountId] = useState(’’);
const [settleAmount, setSettleAmount] = useState(’’);
const [settleAmountErr, setSettleAmountErr] = useState(’’);
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
prev && a.some((x) => x._id === prev)
? prev
: a[0]?._id || ‘’
);
}, []);

useEffect(() => {
load().catch((e) => setErr(e.message));
}, [load]);

useEffect(() => {
const h = () => load().catch((e) => setErr(e.message));
window.addEventListener(‘spendly-sync-done’, h);
return () => window.removeEventListener(‘spendly-sync-done’, h);
}, [load]);

const refresh = () => load().catch((e) => setErr(e.message));

// Open settle modal — pre-fill amount with full outstanding balance
const openSettle = (item) => {
setSettling(item);
setAccountId(accounts[0]?._id || ‘’);
setSettleAmount(String(item.amount));
setSettleAmountErr(’’);
};

const closeSettle = () => {
setSettling(null);
setSettleAmount(’’);
setSettleAmountErr(’’);
};

const doSettle = async (e) => {
e.preventDefault();
if (!settling || !accountId) return;

```
const parsed = parseFloat(settleAmount);

// Validation
if (isNaN(parsed) || parsed <= 0) {
  setSettleAmountErr('Enter a valid amount greater than 0.');
  return;
}
if (parsed > settling.amount) {
  setSettleAmountErr(
    `Cannot exceed the outstanding balance of ${formatMoney(settling.amount)}.`
  );
  return;
}

setSettleAmountErr('');
setErr('');

try {
  const isPartial = parsed < settling.amount;

  if (isPartial) {
    // Partial: settle only the entered amount, keep the rest pending
    await api.settlePartialPending(settling._id, accountId, parsed);
  } else {
    // Full settlement (existing behaviour)
    await api.settlePending(settling._id, accountId);
  }

  closeSettle();
  await refresh();
} catch (ex) {
  setErr(ex.message);
}
```

};

const pending = items.filter((i) => i.status === ‘pending’);
const settled = items.filter((i) => i.status === ‘settled’);

const totalPendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

const editingItem = editing
? pending.find((p) => p._id === editing)
: null;

// Derived values for the settle modal
const settleAmountParsed = parseFloat(settleAmount) || 0;
const isPartialSettle =
settling && settleAmountParsed > 0 && settleAmountParsed < settling.amount;
const remainingAfterSettle =
settling ? Math.max(0, settling.amount - settleAmountParsed) : 0;

return (
<>
<header className="page-header">
<h1>Pending / debts</h1>
</header>

```
  <p
    style={{
      padding: '0 16px',
      color: 'var(--muted)',
      fontSize: '0.9rem',
    }}
  >
    Track money you lent. Balances stay unchanged until you mark a repayment
    as settled — then it posts as income to the account you choose. Tap a
    pending row to edit.
  </p>

  {/* Total pending summary */}
  <div
    style={{
      margin: '12px 16px',
      padding: '12px 16px',
      borderRadius: 12,
      background: 'var(--card)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: '1px solid var(--border)',
    }}
  >
    <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
      Total pending
    </div>
    <div
      style={{
        fontSize: '1.2rem',
        fontWeight: 600,
        color: 'var(--pending)',
      }}
    >
      {formatMoney(totalPendingAmount)}
    </div>
  </div>

  {err && (
    <p style={{ color: 'var(--expense)', padding: '0 16px' }}>
      {err}
    </p>
  )}

  <h2
    style={{
      padding: '0 16px',
      fontSize: '1rem',
      color: 'var(--pending)',
    }}
  >
    Pending
  </h2>

  {pending.length === 0 ? (
    <p className="empty">
      No pending debts. Use the + button on Home to add one.
    </p>
  ) : (
    <ul className="tx-list">
      {pending.map((p) => (
        <li
          key={p._id}
          className="tx-row"
          style={{ gridTemplateColumns: '1fr auto' }}
        >
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
            <div
              className="tx-amount"
              style={{ color: 'var(--pending)' }}
            >
              {formatMoney(p.amount)}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 6,
                justifyContent: 'flex-end',
                marginTop: 8,
                flexWrap: 'wrap',
              }}
            >
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
                onClick={() => openSettle(p)}
              >
                Settle
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )}

  <h2
    style={{
      padding: '16px 16px 0',
      fontSize: '1rem',
      color: 'var(--muted)',
    }}
  >
    Settled
  </h2>

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

          <div
            className="tx-amount"
            style={{ color: 'var(--pending-muted)' }}
          >
            {formatMoney(p.amount)}
          </div>
        </li>
      ))}
    </ul>
  )}

  {/* ── Settle modal ── */}
  {settling && (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={closeSettle}
    >
      <div
        className="modal"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Settle repayment</h2>

        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Outstanding:{' '}
          <strong style={{ color: 'var(--pending)' }}>
            {formatMoney(settling.amount)}
          </strong>{' '}
          from <strong>{settling.personName}</strong>
        </p>

        <form onSubmit={doSettle}>
          {/* Amount field */}
          <div className="field">
            <label className="label">Amount to settle</label>
            <input
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
            {settleAmountErr && (
              <p
                style={{
                  color: 'var(--expense)',
                  fontSize: '0.8rem',
                  marginTop: 4,
                }}
              >
                {settleAmountErr}
              </p>
            )}
          </div>

          {/* Partial settlement info banner */}
          {isPartialSettle && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--card)',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
                color: 'var(--muted)',
                marginBottom: 12,
              }}
            >
              <span>Partial settlement — </span>
              <strong style={{ color: 'var(--pending)' }}>
                {formatMoney(remainingAfterSettle)}
              </strong>
              <span> will remain pending.</span>
            </div>
          )}

          {/* Account selector */}
          <div className="field">
            <label className="label">Post income to account</label>
            <select
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({formatMoney(a.balance)})
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeSettle}
            >
              Cancel
            </button>

            <button type="submit" className="btn btn-primary">
              {isPartialSettle ? 'Settle partial' : 'Confirm'}
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
```

);
}
