import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { usePrivacy } from '../context/PrivacyContext.jsx';
import { formatMonthLong } from '../utils/dates.js';
import { formatDay, formatGroupDate, formatMoney, formatTxTime, monthKey, shiftMonth } from '../utils/format.js';
import { categoryIcon } from '../utils/categoryIcons.js';
import Money from '../components/Money.jsx';
import QuickAddFab from '../components/QuickAddFab.jsx';
import TxModals from '../components/TxModals.jsx';
import EditTransactionModal from '../components/EditTransactionModal.jsx';
import SwipeableRow from '../components/SwipeableRow.jsx';

function txTitle(tx) {
  if (tx.type === 'transfer') {
    return (tx.note && tx.note.trim()) || tx.category || 'Transfer';
  }
  if (tx.type === 'balance_update') {
    return (tx.note && tx.note.trim()) || 'Balance update';
  }
  return (tx.note && tx.note.trim()) || tx.category || 'Transaction';
}

function txSubtitle(tx, accountsById) {
  const day = formatDay(tx.date);
  if (tx.type === 'transfer') {
    const from = accountsById[String(tx.fromAccountId)]?.name || 'Account';
    const to = accountsById[String(tx.toAccountId)]?.name || 'Account';
    return `${day} · ${from} → ${to}`;
  }
  if (tx.type === 'balance_update') {
    const acc = accountsById[String(tx.accountId)]?.name || 'Account';
    return `${day} · ${acc}`;
  }
  const acc = accountsById[String(tx.accountId)]?.name || 'Account';
  return `${day} · ${acc}`;
}

function groupTxsByDate(txs) {
  const groups = {};
  txs.forEach((tx) => {
    const date = tx.date.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function Dashboard() {
  const {
    faceLock,
    credentialId,
    registerBiometric,
    lock,
    unveiled,
    biometricReady,
    revealWithBiometric,
    heroBalanceHidden,
  } = usePrivacy();
  const [faceErr, setFaceErr] = useState('');

  const [month, setMonth] = useState(() => monthKey());
  const [accountFilter, setAccountFilter] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bundle, setBundle] = useState(null);
  const [modal, setModal] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [err, setErr] = useState('');
  const [incomeHidden, setIncomeHidden] = useState(true);
  const [netHidden, setNetHidden] = useState(true);

  const loadMeta = useCallback(async () => {
    const [accs, cats] = await Promise.all([api.accounts(), api.categories()]);
    setAccounts(accs);
    setCategories(cats);
  }, []);

  const loadTx = useCallback(async () => {
    const data = await api.transactions(month, accountFilter || undefined);
    setBundle(data);
  }, [month, accountFilter]);

  const refresh = useCallback(() => {
    loadMeta().catch((e) => setErr(e.message));
    loadTx().catch((e) => setErr(e.message));
  }, [loadMeta, loadTx]);

  const deleteTx = useCallback(
    async (tx) => {
      if (!window.confirm('Delete this transaction? Balances will be recalculated.')) return;
      setErr('');
      try {
        await api.deleteTransaction(tx._id);
        await refresh();
      } catch (e) {
        setErr(e.message);
      }
    },
    [refresh]
  );

  useEffect(() => {
    loadMeta().catch((e) => setErr(e.message));
  }, [loadMeta]);

  useEffect(() => {
    setErr('');
    loadTx().catch((e) => setErr(e.message));
  }, [loadTx]);

  useEffect(() => {
    const onSynced = () => refresh();
    window.addEventListener('spendly-sync-done', onSynced);
    return () => window.removeEventListener('spendly-sync-done', onSynced);
  }, [refresh]);

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [String(a._id), a])),
    [accounts]
  );

  /** Current total: all accounts, or selected account balance */
  const displayTotal = useMemo(() => {
    if (!accounts.length) return 0;
    if (accountFilter) {
      const a = accounts.find((x) => String(x._id) === String(accountFilter));
      return a ? Number(a.balance) || 0 : 0;
    }
    return accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  }, [accounts, accountFilter]);

  const txs = bundle?.transactions || [];
  const opening = bundle?.openingBalance ?? 0;

  const monthIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const endRunning = txs.length ? txs[0].runningBalance : opening;

  const monthTitle = formatMonthLong(new Date(month + '-01T12:00:00'));
  const netMonth = monthIncome - monthExpense;

  const editTxNormalized = editTx
    ? {
        ...editTx,
        accountId: editTx.accountId ? String(editTx.accountId) : '',
        fromAccountId: editTx.fromAccountId ? String(editTx.fromAccountId) : '',
        toAccountId: editTx.toAccountId ? String(editTx.toAccountId) : '',
      }
    : null;

  return (
    <>
      <section className="balance-masthead">
        <p className="balance-masthead-label">
          {accountFilter ? accountsById[accountFilter]?.name || 'Account' : 'Total balance'}
        </p>
        <div className="balance-masthead-amount">
          <Money value={displayTotal} hero />
        </div>
        <p className="balance-masthead-sub">
          {accountFilter ? 'Current balance in this account' : 'Across all your accounts'}
        </p>
        <div className="dashboard-hero-actions balance-masthead-actions">
          {!faceLock || !credentialId ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!biometricReady}
              onClick={async () => {
                setFaceErr('');
                try {
                  await registerBiometric();
                } catch (e) {
                  setFaceErr(e.message || 'Could not enable Face Lock');
                }
              }}
            >
              Enable Face Lock
            </button>
          ) : (
            <>
              {heroBalanceHidden && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => revealWithBiometric().catch(() => {})}
                >
                  Unlock
                </button>
              )}
              {unveiled && (
                <button type="button" className="btn btn-ghost" onClick={() => lock()}>
                  Hide
                </button>
              )}
            </>
          )}
        </div>
        {faceErr && (
          <p className="dashboard-hero-err" role="alert">
            {faceErr}
          </p>
        )}
        {!biometricReady && (!credentialId || !faceLock) && (
          <p className="dashboard-hero-note">
            Face ID / fingerprint is not available in this browser. Use Safari or Chrome on a device with a
            secure screen lock.
          </p>
        )}
      </section>

      <div className="month-bar">
        <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ‹
        </button>
        <strong>{monthTitle}</strong>
        <button type="button" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          ›
        </button>
      </div>

      <div className="dashboard-filter-row">
        <label className="label">Filter by account</label>
        <select
          className="input"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
          <option value="">All accounts (net worth)</option>
          {accounts.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {err && <p style={{ color: 'var(--expense)', padding: '0 16px' }}>{err}</p>}

      {/* <div className="dashboard-month-running card">
        <div className="dashboard-month-running-label">Running balance (this month)</div>
        <div className="dashboard-month-running-amount">{formatMoney(endRunning)}</div>
        <p className="dashboard-month-running-hint">At end of the list for {monthTitle}</p>
      </div> */}

      <div className="summary-strip summary-strip--three">
        <div className="stat">
          <span className="stat-title-row">
            <span>Income</span>
            <button
              type="button"
              className="stat-eye-btn"
              aria-label={incomeHidden ? 'Show income amount' : 'Hide income amount'}
              aria-pressed={incomeHidden}
              onClick={() => setIncomeHidden((v) => !v)}
            >
              {incomeHidden ? (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 1 0 2.8 2.8" />
                  <path d="M9.5 5.5A11.5 11.5 0 0 1 12 5c4.8 0 8.7 2.9 10 7-0.5 1.5-1.4 2.8-2.6 3.9" />
                  <path d="M6.2 8.2A11.3 11.3 0 0 0 2 12c1.3 4.1 5.2 7 10 7 1.2 0 2.3-0.2 3.4-0.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
          <strong className={`type-income ${incomeHidden ? 'stat-hidden-amount' : ''}`}>
            {incomeHidden ? '******' : formatMoney(monthIncome)}
          </strong>
        </div>
        <div className="stat">
          <span>Expenses</span>
          <strong className="type-expense">{formatMoney(monthExpense)}</strong>
        </div>
        <div className="stat">
          <span className="stat-title-row">
            <span>Net (month)</span>
            <button
              type="button"
              className="stat-eye-btn"
              aria-label={netHidden ? 'Show net amount' : 'Hide net amount'}
              aria-pressed={netHidden}
              onClick={() => setNetHidden((v) => !v)}
            >
              {netHidden ? (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 1 0 2.8 2.8" />
                  <path d="M9.5 5.5A11.5 11.5 0 0 1 12 5c4.8 0 8.7 2.9 10 7-0.5 1.5-1.4 2.8-2.6 3.9" />
                  <path d="M6.2 8.2A11.3 11.3 0 0 0 2 12c1.3 4.1 5.2 7 10 7 1.2 0 2.3-0.2 3.4-0.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
          <strong className={netHidden ? 'stat-hidden-amount' : ''}>
            {netHidden ? '******' : formatMoney(netMonth)}
          </strong>
        </div>
      </div>

      {txs.length === 0 ? (
        <p className="empty">No transactions this month. Tap + to add one.</p>
      ) : (
        <div style={{ paddingBottom: '88px' }}>
          {groupTxsByDate(txs).map(([date, dayTxs]) => (
            <div key={date} className="tx-group-card">
              <div className="tx-group-header">
                <span className="tx-group-date">{formatGroupDate(date)}</span>
                <span className="tx-group-count">
                  {dayTxs.length} {dayTxs.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {dayTxs.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';
                  const isBalUpdate = tx.type === 'balance_update';

                  let signPrefix = '';
                  let amtCls = '';
                  let iconCls = '';
                  let showAbs = Math.abs(Number(tx.amount));

                  if (isExpense) {
                    signPrefix = '−';
                    amtCls = 'expense';
                    iconCls = 'expense';
                  } else if (isIncome) {
                    signPrefix = '+';
                    amtCls = 'income';
                    iconCls = 'income';
                  } else if (isBalUpdate) {
                    const d = Number(tx.amount);
                    signPrefix = d >= 0 ? '+' : '−';
                    amtCls = d >= 0 ? 'income' : 'expense';
                    iconCls = 'balance-update';
                  } else {
                    iconCls = 'transfer';
                  }

                  const subtitle = `${tx.note || tx.category} · ${formatDay(tx.date)}`;

                  return (
                    <li key={tx._id}>
                      <SwipeableRow onEdit={() => setEditTx(tx)} onDelete={() => deleteTx(tx)}>
                        <div
                          role="button"
                          tabIndex={0}
                          className="tx-row-v3"
                          onClick={() => setEditTx(tx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setEditTx(tx);
                            }
                          }}
                        >
                          <div className={`tx-icon-circle ${iconCls}`}>
                            {isIncome ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 7l10 10M17 7v10H7" transform="rotate(180 12 12)" />
                              </svg>
                            ) : isExpense ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 7l10 10M17 7v10H7" />
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 3L21 8L16 13" />
                                <path d="M21 8H3" />
                              </svg>
                            )}
                          </div>
                          <div className="tx-v3-body">
                            <div className="tx-v3-title">{tx.category}</div>
                            <div className="tx-v3-subtitle">{subtitle}</div>
                          </div>
                          <div className={`tx-v3-amt ${amtCls}`}>
                            {signPrefix}
                            {formatMoney(showAbs)}
                          </div>
                        </div>
                      </SwipeableRow>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <QuickAddFab onPick={setModal} />
      <TxModals
        key={modal || 'closed'}
        mode={modal}
        onClose={() => setModal(null)}
        accounts={accounts}
        categories={categories}
        onSaved={refresh}
      />
      {editTxNormalized && (
        <EditTransactionModal
          key={editTxNormalized._id}
          tx={editTxNormalized}
          accounts={accounts}
          categories={categories}
          onClose={() => setEditTx(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
