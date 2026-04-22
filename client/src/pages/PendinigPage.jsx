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
    <>
      <header className="page-header">
        <h1>Pending / debts</h1>
      </header>

      <p style={{ padding: '0 16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
        Track money you lent. Mark repayments as settled to post income.
      </p>

      <div
        style={{
          margin: '12px 16px',
          padding: '12px 16px',
          borderRadius: 12,
          background: 'var(--surface)',
          display: 'flex',
          justifyContent: 'space-between',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ color: 'var(--muted)' }}>Total pending</div>
        <div style={{ fontWeight: 600, color: 'var(--pending)' }}>
          {formatMoney(totalPendingAmount)}
        </div>
      </div>

      {err && <p style={{ color: 'var(--expense)', padding: '0 16px' }}>{err}</p>}

      <h2 style={{ padding: '0 16px', color: 'var(--pending)' }}>Pending</h2>

      {pending.length === 0 ? (
        <p className="empty">No pending debts.</p>
      ) : (
        <ul className="tx-list">
          {pending.map((p) => (
            <li key={p._id} className="tx-row">
              <button onClick={() => setEditing(p._id)}>
                <div>{p.personName}</div>
                <div>
                  {formatDay(p.date)} · {p.category}
                </div>
              </button>

              <div>
                <div>{formatMoney(p.amount)}</div>
                <button onClick={() => openSettle(p)}>Settle</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {settling && (
        <div className="modal-backdrop" onClick={closeSettle}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Settle repayment</h2>

            <form onSubmit={doSettle}>
              <input
                type="number"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
              />

              {isPartialSettle && (
                <p>
                  Remaining: {formatMoney(remainingAfterSettle)}
                </p>
              )}

              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <button type="submit">
                {isPartialSettle ? 'Settle partial' : 'Confirm'}
              </button>
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