import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatMoney } from '../utils/format.js';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [adjusting, setAdjusting] = useState(null);
  const [newBalanceStr, setNewBalanceStr] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustDate, setAdjustDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [accs, cats] = await Promise.all([api.accounts(), api.categories()]);
    setAccounts(accs);
    setCategories(cats);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  useEffect(() => {
    const h = () => load().catch((e) => setErr(e.message));
    window.addEventListener('spendly-sync-done', h);
    return () => window.removeEventListener('spendly-sync-done', h);
  }, [load]);

  const addAccount = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setErr('');
    try {
      await api.createAccount({ name: newName.trim() });
      setNewName('');
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const saveEdit = async (id) => {
    setErr('');
    try {
      await api.updateAccount(id, { name: editName.trim() });
      setEditing(null);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const remove = async (id) => {
    setErr('');
    try {
      await api.deleteAccount(id);
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const openAdjust = (a) => {
    setAdjusting(a);
    setNewBalanceStr(String(a.balance));
    setAdjustNote('');
    setAdjustDate(new Date().toISOString().slice(0, 10));
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    if (!adjusting) return;
    const newBal = Number(newBalanceStr);
    if (Number.isNaN(newBal)) {
      setErr('Enter a valid balance');
      return;
    }
    setErr('');
    setAdjustBusy(true);
    try {
      await api.updateAccountBalance({
        accountId: adjusting._id,
        newBalance: newBal,
        date: new Date(adjustDate + 'T12:00:00').toISOString(),
        note: adjustNote.trim(),
      });
      setAdjusting(null);
      await load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setAdjustBusy(false);
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    setErr('');
    try {
      await api.addCategory(newCat.trim());
      setNewCat('');
      await load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Accounts</h1>
      </header>

      {err && <p style={{ color: 'var(--expense)', padding: '0 16px' }}>{err}</p>}

      <ul className="tx-list">
        {accounts.map((a) => (
          <li key={a._id} className="tx-row" style={{ gridTemplateColumns: '1fr auto' }}>
            <div>
              {editing === a._id ? (
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              ) : (
                <div className="tx-title">{a.name}</div>
              )}
              <div className="tx-meta" style={{ textTransform: 'capitalize' }}>
                {a.type}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tx-amount">{formatMoney(a.balance)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                {editing === a._id ? (
                  <>
                    <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={() => saveEdit(a._id)}>
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px' }}
                      onClick={() => {
                        setEditing(a._id);
                        setEditName(a.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px 10px' }}
                      onClick={() => openAdjust(a)}
                    >
                      Set balance
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => remove(a._id)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div style={{ padding: '0 16px 24px' }}>
        <form onSubmit={addAccount} className="card">
          <strong>New account</strong>
          <div className="field" style={{ marginTop: 12 }}>
            <label className="label">Name</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Savings" />
          </div>
          <button type="submit" className="btn btn-primary">
            Add account
          </button>
        </form>

        <form onSubmit={addCategory} className="card" style={{ marginTop: 16 }}>
          <strong>Custom category</strong>
          <div className="field" style={{ marginTop: 12 }}>
            <label className="label">Name</label>
            <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Subscriptions" />
          </div>
          <button type="submit" className="btn btn-primary">
            Add category
          </button>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 12, marginBottom: 0 }}>
            Existing: {categories.map((c) => c.name).join(', ')}
          </p>
        </form>
      </div>

      {adjusting && (
        <div className="modal-backdrop" role="presentation" onClick={() => !adjustBusy && setAdjusting(null)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Set balance · {adjusting.name}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: 0 }}>
              Current: {formatMoney(adjusting.balance)}. Saving creates a <strong style={{ color: 'var(--balance-update)' }}>Balance update</strong>{' '}
              transaction (reconciliation), not income or expense.
            </p>
            <form onSubmit={submitAdjust}>
              <div className="field">
                <label className="label">New balance (₹)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  value={newBalanceStr}
                  onChange={(e) => setNewBalanceStr(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Date</label>
                <input className="input" type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Note (optional)</label>
                <input
                  className="input"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="e.g. Cash count correction"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" disabled={adjustBusy} onClick={() => setAdjusting(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={adjustBusy}>
                  {adjustBusy ? 'Saving…' : 'Save & record update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
