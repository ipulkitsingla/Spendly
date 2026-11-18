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
  const [newAccType, setNewAccType] = useState('custom');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [newBillingDate, setNewBillingDate] = useState('1');
  const [newDueDate, setNewDueDate] = useState('15');
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

  const totalAssets = useMemo(() => accounts.filter(a => a.type !== 'credit').reduce((sum, a) => sum + (Number(a.balance) || 0), 0), [accounts]);
  const totalLiabilities = useMemo(() => accounts.filter(a => a.type === 'credit').reduce((sum, a) => sum + (Number(a.billedAmount) || 0) + (Number(a.unbilledAmount) || 0), 0), [accounts]);
  const netWorth = totalAssets - totalLiabilities;

  const addAccount = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setErr('');
    try {
      await api.createAccount({ 
        name: newName.trim(),
        type: newAccType,
        creditLimit: newAccType === 'credit' ? Number(newCreditLimit) : undefined,
        billingDate: newAccType === 'credit' ? Number(newBillingDate) : undefined,
        dueDate: newAccType === 'credit' ? Number(newDueDate) : undefined,
      });
      setNewName('');
      setNewAccType('custom');
      setNewCreditLimit('');
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

  const removeCategory = async (name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    setErr('');
    try {
      await api.deleteCategory(name);
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
        <h2 className="accounts-hero-amount">{formatMoney(netWorth)}</h2>
        <div className="net-worth-breakdown" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Assets</span>
            <div style={{ color: 'var(--income)', fontWeight: 'bold' }}>{formatMoney(totalAssets)}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Liabilities</span>
            <div style={{ color: 'var(--expense)', fontWeight: 'bold' }}>{formatMoney(totalLiabilities)}</div>
          </div>
        </div>
      </section>

      {err && <p className="error-msg" style={{ margin: '0 16px 16px' }}>{err}</p>}

      <div className="accounts-content">
        <div className="section-title-row">
          <h3>My Assets</h3>
          <button type="button" className="btn-link" onClick={() => document.getElementById('new-acc-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Add New</button>
        </div>

        <div className="accounts-grid">
          {accounts.map((a) => {
            const isCredit = a.type === 'credit';
            const used = (a.billedAmount || 0) + (a.unbilledAmount || 0);
            const limit = a.creditLimit || 0;
            const available = limit - used;
            const progress = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

            return (
            <div key={a._id} className="card account-detail-card animate-fade-up">
              <div className="acc-detail-head">
                <div className="acc-type-icon">{isCredit ? '💳' : '🏦'}</div>
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
                <div className="acc-balance-val" style={{ color: isCredit ? 'var(--expense)' : 'inherit' }}>
                  {isCredit ? formatMoney(used) : formatMoney(a.balance)}
                </div>
              </div>
              
              {isCredit && (
                <div style={{ marginTop: '12px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ opacity: 0.8 }}>Available: <strong style={{ color: 'var(--income)' }}>{formatMoney(available)}</strong></span>
                    <span style={{ opacity: 0.8 }}>Limit: {formatMoney(limit)}</span>
                  </div>
                  <div className="budget-progress-track">
                    <div className={`budget-progress-fill ${progress > 80 ? 'over' : ''}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.8rem', opacity: 0.8 }}>
                    <div>Billed: <strong style={{ color: 'var(--text)' }}>{formatMoney(a.billedAmount)}</strong></div>
                    <div>Unbilled: <strong style={{ color: 'var(--text)' }}>{formatMoney(a.unbilledAmount)}</strong></div>
                  </div>
                </div>
              )}

              <div className="acc-actions-row">
                <button type="button" className="btn btn-ghost btn-xs text-primary" onClick={() => navigate(`/?accountId=${a._id}`)}>Transactions</button>
                {!isCredit && <button type="button" className="btn btn-ghost btn-xs" onClick={() => openAdjust(a)}>Adjust Balance</button>}
                <div className="acc-more-actions">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setEditing(a._id); setEditName(a.name); }}>Rename</button>
                  <button type="button" className="btn btn-ghost btn-xs text-danger" onClick={() => remove(a._id)}>Delete</button>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        <div className="accounts-forms-row">
          <form id="new-acc-form" onSubmit={addAccount} className="card form-card animate-fade-up">
            <div className="card-header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <h4>New Account</h4>
            </div>
            <div className="form-group">
              <label className="label">Account Type</label>
              <select className="input" value={newAccType} onChange={(e) => setNewAccType(e.target.value)}>
                <option value="custom">Standard Bank/Cash</option>
                <option value="credit">Credit Card</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Account Name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. HDFC Bank" />
            </div>
            {newAccType === 'credit' && (
              <>
                <div className="form-group">
                  <label className="label">Credit Limit</label>
                  <input className="input" type="number" value={newCreditLimit} onChange={(e) => setNewCreditLimit(e.target.value)} placeholder="e.g. 50000" required />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="label">Billing Date</label>
                    <input className="input" type="number" min="1" max="31" value={newBillingDate} onChange={(e) => setNewBillingDate(e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="label">Due Date</label>
                    <input className="input" type="number" min="1" max="31" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} required />
                  </div>
                </div>
              </>
            )}
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
            <div style={{ marginTop: '16px' }}>
              <label className="label">Your Custom Categories</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {categories.filter(c => c.isCustom).map(c => (
                  <span key={c.name} className="acc-type-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {c.name}
                    <button type="button" onClick={() => removeCategory(c.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--expense)' }}>×</button>
                  </span>
                ))}
              </div>
            </div>
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
