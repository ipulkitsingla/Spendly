import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { formatMonthLong } from '../utils/dates.js';
import { monthKey, shiftMonth } from '../utils/format.js';
import { downloadMonthStatementPdf } from '../utils/pdfExport.js';
import { APP_VERSION } from '../utils/appMeta.js';

export default function ProfilePage() {
  const { user, logout, updateEmailPreferences } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [exportMonth, setExportMonth] = useState(() => monthKey());
  const [exportAccountId, setExportAccountId] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr] = useState('');
  const [emailPrefSaving, setEmailPrefSaving] = useState('');
  const [emailPrefErr, setEmailPrefErr] = useState('');

  useEffect(() => {
    api
      .accounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const monthLabel = useMemo(
    () => formatMonthLong(new Date(`${exportMonth}-01T12:00:00`)),
    [exportMonth]
  );

  const scopeLabel = useMemo(() => {
    if (!exportAccountId) return 'All accounts (net worth)';
    const a = accounts.find((x) => String(x._id) === String(exportAccountId));
    return a?.name || 'One account';
  }, [accounts, exportAccountId]);

  const onDownloadPdf = useCallback(async () => {
    setPdfErr('');
    setPdfLoading(true);
    try {
      const bundle = await api.transactions(exportMonth, exportAccountId || undefined);
      downloadMonthStatementPdf({
        month: exportMonth,
        bundle,
        userName: user?.name,
        userEmail: user?.email,
        scopeLabel,
      });
    } catch (e) {
      setPdfErr(e?.message || 'Could not build PDF. Try again when online.');
    } finally {
      setPdfLoading(false);
    }
  }, [exportMonth, exportAccountId, user, scopeLabel]);

  const emailPrefs = user?.emailPreferences || {
    monthlyStatement: true,
    expenseReminder: true,
    pendingDebtReminder: true,
    welcomeSignup: true,
  };

  const onTogglePref = useCallback(
    async (key) => {
      const next = !emailPrefs[key];
      setEmailPrefErr('');
      setEmailPrefSaving(key);
      try {
        await updateEmailPreferences({ [key]: next });
      } catch (e) {
        setEmailPrefErr(e?.message || 'Could not update email preferences.');
      } finally {
        setEmailPrefSaving('');
      }
    },
    [emailPrefs, updateEmailPreferences]
  );

  return (
    <div className="profile-container animate-fade-in">
      <header className="profile-hero">
        <div className="profile-hero-bg" />
        <div className="profile-avatar-large">
          {(user?.name || '?').slice(0, 1).toUpperCase()}
        </div>
        <h1 className="profile-user-name">{user?.name}</h1>
        <p className="profile-user-email">{user?.email}</p>
        <button type="button" className="btn btn-ghost btn-sm profile-logout-btn" onClick={logout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Log Out
        </button>
      </header>

      <div className="profile-content">
        <section className="card export-card animate-fade-up">
          <div className="card-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <h3>Generate Reports</h3>
          </div>
          <p className="card-desc">Download your transaction history as a professional PDF statement.</p>
          
          <div className="export-options">
            <div className="form-group">
              <label className="label">Statement Month</label>
              <input
                className="input"
                type="month"
                value={exportMonth}
                max={monthKey()}
                onChange={(e) => setExportMonth(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="label">Account Scope</label>
              <select
                className="input"
                value={exportAccountId}
                onChange={(e) => setExportAccountId(e.target.value)}
              >
                <option value="">All Accounts (Net Worth)</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-block export-btn"
            disabled={pdfLoading}
            onClick={onDownloadPdf}
          >
            {pdfLoading ? 'Building PDF...' : 'Download PDF Statement'}
          </button>
          {pdfErr && <p className="error-text">{pdfErr}</p>}
        </section>

        <section className="card settings-card animate-fade-up">
          <div className="card-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
            <h3>Notifications</h3>
          </div>
          
          <div className="pref-list">
            {[
              { key: 'monthlyStatement', title: 'Monthly Summary', desc: 'Auto-email on the 1st' },
              { key: 'expenseReminder', title: 'Daily Reminder', desc: 'Add expenses at 9 PM' },
              { key: 'pendingDebtReminder', title: 'Debt Alerts', desc: 'Pending items at 10 PM' },
            ].map((pref) => (
              <div key={pref.key} className="pref-row" onClick={() => onTogglePref(pref.key)}>
                <div className="pref-info">
                  <span className="pref-title">{pref.title}</span>
                  <span className="pref-desc">{pref.desc}</span>
                </div>
                <div className={`pref-toggle ${emailPrefs[pref.key] ? 'on' : 'off'}`}>
                  <div className="toggle-handle" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="profile-footer">
          <p className="app-info">Spendly Premium • {APP_VERSION}</p>
          <p className="app-copyright">© 2026 Spendly Inc.</p>
        </div>
      </div>
    </div>
  );
}
