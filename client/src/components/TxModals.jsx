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

export default function TxModals({ mode, onClose, accounts, categories = [], onSaved, defaultCategory }) {
  const catList = categories.length ? categories : [{ name: 'Other', isCustom: true }];
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultCategory || catList[0]?.name || 'Other');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(accounts[0]?._id || '');
  const [fromId, setFromId] = useState(accounts[0]?._id || '');
  const [toId, setToId] = useState(accounts[1]?._id || accounts[0]?._id || '');
  const [personName, setPersonName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [suggestedNotes, setSuggestedNotes] = useState([]);

  useEffect(() => {
    if (mode) {
      api.notes().then(setSuggestedNotes).catch(() => {});
    }
  }, [mode]);

  const reset = () => {
    setAmount('');
    setNote('');
    setErr('');
    setPersonName('');
    setDate(new Date().toISOString().slice(0, 10));
    setCategory(defaultCategory || catList[0]?.name || 'Other');
    setAccountId(accounts[0]?._id || '');
    setFromId(accounts[0]?._id || '');
    setToId(accounts[1]?._id || accounts[0]?._id || '');
  };

  const close = () => {
    reset();
    onClose();
  };

  if (!mode) return null;

  const title =
    mode === 'income'
      ? 'Add income'
      : mode === 'expense'
          ? 'Add expense'
          : mode === 'transfer'
            ? 'Transfer'
            : 'Pending debt (lent)';

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const num = Number(amount);
    if (Number.isNaN(num) || num < 0) {
      setErr('Enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'pending') {
        if (!personName.trim()) {
          setErr('Person name is required');
          setBusy(false);
          return;
        }
        await api.createPending({
          personName: personName.trim(),
          amount: num,
          category: category || 'Debt',
          date: new Date(date).toISOString(),
          note,
        });
      } else if (mode === 'transfer') {
        if (fromId === toId) {
          setErr('Choose two different accounts');
          setBusy(false);
          return;
        }
        await api.createTransaction({
          type: 'transfer',
          amount: num,
          category: 'Transfer',
          fromAccountId: fromId,
          toAccountId: toId,
          date: new Date(date).toISOString(),
          note,
        });
      } else {
        await api.createTransaction({
          type: mode,
          amount: num,
          category: category || 'Other',
          accountId,
          date: new Date(date).toISOString(),
          note,
        });
      }
      onSaved();
      close();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {err && <p style={{ color: 'var(--expense)', fontSize: '0.9rem' }}>{err}</p>}
        <form onSubmit={submit}>
          {mode === 'pending' && (
            <Field label="Person">
              <input
                className="input"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Who owes you?"
                required
              />
            </Field>
          )}
          <Field label="Amount">
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          {mode !== 'transfer' && (
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
          {(mode === 'income' || mode === 'expense') && (
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
          {mode === 'transfer' && (
            <>
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
          <Field label="Date">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <input className="input" list={note.trim().length > 0 ? "tx-notes-list" : undefined} value={note} onChange={(e) => setNote(e.target.value)} />
            <datalist id="tx-notes-list">
              {suggestedNotes.map(n => <option key={n} value={n} />)}
            </datalist>
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>
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
