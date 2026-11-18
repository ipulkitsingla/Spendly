import { useState, useEffect } from 'react';
import { api } from '../api.js';

function Field({ label, children }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export default function EditTransactionModal({ tx, accounts, categories = [], onClose, onSaved }) {
  const catList = categories.length ? categories : [{ name: 'Other', isCustom: true }];
  const [amount, setAmount] = useState(String(tx.amount));
  const [newBalance, setNewBalance] = useState(String(tx.balanceAfterTransaction ?? ''));
  const [category, setCategory] = useState(tx.category || 'Other');
  const [note, setNote] = useState(tx.note || '');
  const [date, setDate] = useState(() => new Date(tx.date).toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(tx.accountId || '');
  const [fromId, setFromId] = useState(tx.fromAccountId || '');
  const [toId, setToId] = useState(tx.toAccountId || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [suggestedNotes, setSuggestedNotes] = useState([]);

  useEffect(() => {
    if (tx) {
      api.notes().then(setSuggestedNotes).catch(() => {});
    }
  }, [tx]);

  if (!tx) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (tx.type === 'balance_update') {
        const nb = Number(newBalance);
        if (Number.isNaN(nb)) {
          setErr('Invalid balance');
          setBusy(false);
          return;
        }
        await api.patchTransaction(tx._id, {
          newBalance: nb,
          note,
          date: new Date(date + 'T12:00:00').toISOString(),
          accountId,
        });
      } else if (tx.type === 'transfer') {
        const num = Number(amount);
        if (Number.isNaN(num) || num < 0) {
          setErr('Invalid amount');
          setBusy(false);
          return;
        }
        if (fromId === toId) {
          setErr('Choose two different accounts');
          setBusy(false);
          return;
        }
        await api.patchTransaction(tx._id, {
          amount: num,
          category,
          note,
          date: new Date(date + 'T12:00:00').toISOString(),
          fromAccountId: fromId,
          toAccountId: toId,
        });
      } else {
        const num = Number(amount);
        if (Number.isNaN(num) || num < 0) {
          setErr('Invalid amount');
          setBusy(false);
          return;
        }
        await api.patchTransaction(tx._id, {
          amount: num,
          category,
          note,
          date: new Date(date + 'T12:00:00').toISOString(),
          accountId,
        });
      }
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this transaction? Balances will be recalculated.')) return;
    setErr('');
    setBusy(true);
    try {
      await api.deleteTransaction(tx._id);
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const title =
    tx.type === 'income'
      ? 'Edit income'
      : tx.type === 'expense'
        ? 'Edit expense'
        : tx.type === 'transfer'
          ? 'Edit transfer'
          : 'Edit balance update';

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {err && <p style={{ color: 'var(--expense)', fontSize: '0.9rem' }}>{err}</p>}
        <form onSubmit={submit}>
          {tx.type === 'balance_update' ? (
            <Field label="Account balance after update (₹)">
              <input
                className="input"
                inputMode="decimal"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                required
              />
            </Field>
          ) : (
            <Field label="Amount (₹)">
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
          )}

          {tx.type !== 'balance_update' && tx.type !== 'transfer' && (
            <Field label="Category">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {catList.map((c) => (
                  <option key={c._id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {tx.type === 'transfer' && (
            <>
              <Field label="Category / label">
                <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
              </Field>
              <Field label="From">
                <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="To">
                <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {(tx.type === 'income' || tx.type === 'expense') && (
            <Field label="Account">
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {tx.type === 'balance_update' && (
            <Field label="Account">
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Date">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <input className="input" list={note.trim().length > 0 ? "edit-tx-notes-list" : undefined} value={note} onChange={(e) => setNote(e.target.value)} />
            <datalist id="edit-tx-notes-list">
              {suggestedNotes.map(n => <option key={n} value={n} />)}
            </datalist>
          </Field>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
              Delete
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
