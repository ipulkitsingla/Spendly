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
    <>
      <header className="page-header">
        <h1>Profile</h1>
      </header>

      <div className="profile-page">
        <div className="card profile-card">
          <div className="profile-avatar" aria-hidden>
            {(user?.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-field">
            <span className="label">Name</span>
            <p className="profile-value">{user?.name}</p>
          </div>
          <div className="profile-field">
            <span className="label">Email</span>
            <p className="profile-value">{user?.email}</p>
          </div>
        </div>

        <section className="card export-pdf-card" aria-labelledby="export-pdf-title">
          <div className="export-pdf-head">
            <div className="export-pdf-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div>
              <h2 id="export-pdf-title" className="export-pdf-title">
                Monthly statement
              </h2>
              <p className="export-pdf-desc">Download a clean PDF of transactions for any month — great for taxes or sharing.</p>
            </div>
          </div>

          <div className="export-pdf-chips">
            <button
              type="button"
              className={`export-chip ${exportMonth === monthKey() ? 'export-chip--active' : ''}`}
              onClick={() => setExportMonth(monthKey())}
            >
              This month
            </button>
            <button
              type="button"
              className={`export-chip ${exportMonth === shiftMonth(monthKey(), -1) ? 'export-chip--active' : ''}`}
              onClick={() => setExportMonth(shiftMonth(monthKey(), -1))}
            >
              Last month
            </button>
          </div>

          <div className="export-pdf-fields">
            <div className="export-pdf-field">
              <label className="label" htmlFor="export-month">
                Month
              </label>
              <input
                id="export-month"
                className="input export-month-input"
                type="month"
                value={exportMonth}
                max={monthKey()}
                onChange={(e) => setExportMonth(e.target.value)}
              />
              <p className="export-pdf-preview">{monthLabel}</p>
            </div>
            <div className="export-pdf-field">
              <label className="label" htmlFor="export-account">
                Scope
              </label>
              <select
                id="export-account"
                className="input"
                value={exportAccountId}
                onChange={(e) => setExportAccountId(e.target.value)}
              >
                <option value="">All accounts (net worth)</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {pdfErr && (
            <p className="export-pdf-err" role="alert">
              {pdfErr}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary export-pdf-btn"
            disabled={pdfLoading}
            onClick={onDownloadPdf}
          >
            {pdfLoading ? (
              <span className="export-pdf-btn-inner">
                <span className="export-spinner" aria-hidden />
                Building PDF…
              </span>
            ) : (
              <span className="export-pdf-btn-inner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </span>
            )}
          </button>
        </section>

        <div className="card profile-settings-card">
          <h2 className="profile-section-title">Email notifications</h2>
          <p className="profile-hint">Control monthly statements, reminders, and welcome emails for this account.</p>
          <div className="profile-email-prefs">
            <button
              type="button"
              className="profile-pref-row"
              onClick={() => onTogglePref('monthlyStatement')}
              disabled={emailPrefSaving === 'monthlyStatement'}
            >
              <div>
                <strong>Monthly statement (1st day)</strong>
                <span>Receive statement email with PDF attachment.</span>
              </div>
              <span className={`profile-pref-pill ${emailPrefs.monthlyStatement ? 'on' : 'off'}`}>
                {emailPrefSaving === 'monthlyStatement' ? 'Saving...' : emailPrefs.monthlyStatement ? 'On' : 'Off'}
              </span>
            </button>
            <button
              type="button"
              className="profile-pref-row"
              onClick={() => onTogglePref('expenseReminder')}
              disabled={emailPrefSaving === 'expenseReminder'}
            >
              <div>
                <strong>Expense reminder (9PM)</strong>
                <span>Daily reminder to add today&apos;s expenses.</span>
              </div>
              <span className={`profile-pref-pill ${emailPrefs.expenseReminder ? 'on' : 'off'}`}>
                {emailPrefSaving === 'expenseReminder' ? 'Saving...' : emailPrefs.expenseReminder ? 'On' : 'Off'}
              </span>
            </button>
            <button
              type="button"
              className="profile-pref-row"
              onClick={() => onTogglePref('pendingDebtReminder')}
              disabled={emailPrefSaving === 'pendingDebtReminder'}
            >
              <div>
                <strong>Pending debt reminder (10PM)</strong>
                <span>Daily reminder when there are pending debts.</span>
              </div>
              <span className={`profile-pref-pill ${emailPrefs.pendingDebtReminder ? 'on' : 'off'}`}>
                {emailPrefSaving === 'pendingDebtReminder' ? 'Saving...' : emailPrefs.pendingDebtReminder ? 'On' : 'Off'}
              </span>
            </button>
            <button
              type="button"
              className="profile-pref-row"
              onClick={() => onTogglePref('welcomeSignup')}
              disabled={emailPrefSaving === 'welcomeSignup'}
            >
              <div>
                <strong>Welcome signup email</strong>
                <span>Receive welcome email after account registration.</span>
              </div>
              <span className={`profile-pref-pill ${emailPrefs.welcomeSignup ? 'on' : 'off'}`}>
                {emailPrefSaving === 'welcomeSignup' ? 'Saving...' : emailPrefs.welcomeSignup ? 'On' : 'Off'}
              </span>
            </button>
          </div>
          {emailPrefErr && (
            <p className="profile-email-err" role="alert">
              {emailPrefErr}
            </p>
          )}

          <h2 className="profile-section-title">Session</h2>
          <p className="profile-hint">Sign out on this device. You will need your password to sign in again.</p>
          <button type="button" className="btn btn-ghost profile-logout" onClick={() => logout()}>
            Log out
          </button>
          <div className="profile-app-version">App version {APP_VERSION}</div>
        </div>
      </div>
    </>
  );
}
