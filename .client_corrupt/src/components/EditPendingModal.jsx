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

export default function EditPendingModal({ item, categories = [], onClose, onSaved }) {
  const catList = categories.length ? categories : [{ name: 'Debt', isCustom: false }];
  const [personName, setPersonName] = useState(item.personName || '');
  const [amount, setAmount] = useState(String(item.amount ?? ''));
  const [category, setCategory] = useState(item.category || 'Debt');
  const [date, setDate] = useState(() => new Date(item.date).toISOString().slice(0, 10));
  const [note, setNote] = useState(item.note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [suggestedNotes, setSuggestedNotes] = useState([]);

  useEffect(() => {
    if (item) {
      api.notes().then(setSuggestedNotes).catch(() => {});
    }
  }, [item]);

  if (!item || item.status !== 'pending') return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!personName.trim()) {
      setErr('Person name is required');
      return;
    }
    const num = Number(amount);
    if (Number.isNaN(num) || num < 0) {
      setErr('Invalid amount');
      return;
    }
    setBusy(true);
    try {
      await api.patchPending(item._id, {
        personName: personName.trim(),
        amount: num,
        category: category || 'Debt',
        date: new Date(date + 'T12:00:00').toISOString(),
        note,
      });
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this pending debt?')) return;
    setErr('');
    setBusy(true);
    try {
      await api.deletePending(item._id);
      onSaved();
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Edit pending debt</h2>
        {err && <p style={{ color: 'var(--expense)', fontSize: '0.9rem' }}>{err}</p>}
        <form onSubmit={submit}>
          <Field label="Person">
            <input className="input" value={personName} onChange={(e) => setPersonName(e.target.value)} required />
          </Field>
          <Field label="Amount (₹)">
            <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {catList.map((c) => (
                <option key={c._id || c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <input className="input" list={note.trim().length > 0 ? "edit-pending-notes" : undefined} value={note} onChange={(e) => setNote(e.target.value)} />
            <datalist id="edit-pending-notes">
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
