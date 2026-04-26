import { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { formatMoney } from '../utils/format.js';

export default function AccountsPage() {
  const navigate = useNavigate();
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

  const totalAssets = useMemo(() => accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0), [accounts]);

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
    if (!window.confirm('Delete this account and all its transactions?')) return;
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
    <div className="accounts-container animate-fade-in">
      <header className="page-header">
        <h1>Accounts</h1>
      </header>

      <section className="accounts-hero card animate-fade-up">
        <div className="accounts-hero-glow" />
        <p className="accounts-hero-label">Net Worth</p>
        <h2 className="accounts-hero-amount">{formatMoney(totalAssets)}</h2>
        <p className="accounts-hero-sub">Combined balance across {accounts.length} accounts</p>
      </section>

      {err && <p className="error-msg" style={{ margin: '0 16px 16px' }}>{err}</p>}

      <div className="accounts-content">
        <div className="section-title-row">
          <h3>My Assets</h3>
          <button type="button" className="btn-link" onClick={() => document.getElementById('new-acc-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Add New</button>
        </div>

        <div className="accounts-grid">
          {accounts.map((a) => (
            <div key={a._id} className="card account-detail-card animate-fade-up">
              <div className="acc-detail-head">
                <div className="acc-type-icon">🏦</div>
                <div className="acc-info-main">
                  {editing === a._id ? (
                    <input
                      autoFocus
                      className="input input-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => saveEdit(a._id)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(a._id)}
                    />
                  ) : (
                    <h4 className="acc-name-label" onClick={() => { setEditing(a._id); setEditName(a.name); }}>{a.name}</h4>
                  )}
                  <span className="acc-type-tag">{a.type}</span>
                </div>
                <div className="acc-balance-val">{formatMoney(a.balance)}</div>
              </div>
              
              <div className="acc-actions-row">
                <button type="button" className="btn btn-ghost btn-xs text-primary" onClick={() => navigate(`/?accountId=${a._id}`)}>Transactions</button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => openAdjust(a)}>Adjust Balance</button>
                <div className="acc-more-actions">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setEditing(a._id); setEditName(a.name); }}>Rename</button>
                  <button type="button" className="btn btn-ghost btn-xs text-danger" onClick={() => remove(a._id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="accounts-forms-row">
          <form id="new-acc-form" onSubmit={addAccount} className="card form-card animate-fade-up">
            <div className="card-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <h4>New Account</h4>
            </div>
            <div className="form-group">
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. HDFC Bank" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm btn-block">Create Account</button>
          </form>

          <form onSubmit={addCategory} className="card form-card animate-fade-up">
            <div className="card-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              <h4>Custom Category</h4>
            </div>
            <div className="form-group">
              <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Amazon Prime" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm btn-block">Add Category</button>
          </form>
        </div>
      </div>

      {adjusting && (
        <div className="modal-backdrop" onClick={() => !adjustBusy && setAdjusting(null)}>
          <div className="modal animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Balance Correction</h3>
              <button type="button" className="btn-close" onClick={() => setAdjusting(null)}>×</button>
            </div>
            
            <p className="modal-subtitle">Update balance for <strong>{adjusting.name}</strong>. This creates a reconciliation entry.</p>

            <form onSubmit={submitAdjust}>
              <div className="form-group">
                <label className="label">Current Balance: {formatMoney(adjusting.balance)}</label>
                <input
                  autoFocus
                  className="input"
                  type="number"
                  step="0.01"
                  value={newBalanceStr}
                  onChange={(e) => setNewBalanceStr(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">As of Date</label>
                <input className="input" type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Note</label>
                <input
                  className="input"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Reason for adjustment"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" disabled={adjustBusy} onClick={() => setAdjusting(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adjustBusy}>
                  {adjustBusy ? 'Syncing...' : 'Update Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
