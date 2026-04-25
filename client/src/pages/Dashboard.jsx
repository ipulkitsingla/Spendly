import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { usePrivacy } from '../context/PrivacyContext.jsx';
import { formatMonthLong } from '../utils/dates.js';
import { formatDay, formatMoney, monthKey, shiftMonth } from '../utils/format.js';
import { categoryIcon } from '../utils/categoryIcons.js';
import { parseVoiceAdd } from '../utils/voiceAdd.js';
import { hapticError, hapticLight, hapticSuccess } from '../utils/haptics.js';
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
  const [voiceStatus, setVoiceStatus] = useState('');
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef(null);

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

  useEffect(
    () => () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* no-op */
        }
      }
    },
    []
  );

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

  const runVoiceAdd = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      hapticError();
      setVoiceStatus('Voice input is not supported in this browser.');
      return;
    }
    if (!accounts.length) {
      hapticError();
      setVoiceStatus('Create an account first to use Voice Add.');
      return;
    }

    setVoiceStatus('Listening… say "log ₹120 lunch".');
    setVoiceListening(true);
    hapticLight();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = async (event) => {
      const heard = event.results?.[0]?.[0]?.transcript || '';
      const parsed = parseVoiceAdd(heard, categories);
      if (!parsed.ok) {
        hapticError();
        setVoiceStatus(parsed.message);
        return;
      }

      const chosenAccountId = accountFilter || accounts[0]?._id;
      if (!chosenAccountId) {
        hapticError();
        setVoiceStatus('No account available to add transaction.');
        return;
      }

      try {
        await api.createTransaction({
          ...parsed.payload,
          accountId: chosenAccountId,
          date: new Date().toISOString(),
        });
        await refresh();
        hapticSuccess();
        setVoiceStatus(
          `Added ${parsed.payload.type} ${formatMoney(parsed.payload.amount)} for ${parsed.payload.category}.`
        );
      } catch (e) {
        hapticError();
        setVoiceStatus(e.message || 'Could not add voice transaction.');
      }
    };

    recognition.onerror = (event) => {
      hapticError();
      if (event.error === 'not-allowed') {
        setVoiceStatus('Microphone permission denied.');
      } else if (event.error === 'no-speech') {
        setVoiceStatus('No speech detected. Try again.');
      } else {
        setVoiceStatus('Voice recognition failed. Try again.');
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [accounts, accountFilter, categories, refresh]);

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
        <div className="dashboard-voice-row">
          <button
            type="button"
            className={`btn btn-ghost dashboard-voice-btn${voiceListening ? ' dashboard-voice-btn--live' : ''}`}
            onClick={runVoiceAdd}
            disabled={voiceListening}
          >
            {voiceListening ? 'Listening…' : 'Voice Add'}
          </button>
          {voiceStatus && <p className="dashboard-voice-status">{voiceStatus}</p>}
        </div>
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
        <ul className="tx-list-v2">
          {txs.map((tx) => {
            const cls =
              tx.type === 'income'
                ? 'type-income'
                : tx.type === 'expense'
                  ? 'type-expense'
                  : tx.type === 'balance_update'
                    ? 'type-balance-update'
                    : 'type-transfer';

            let signPrefix = '';
            let showAbs = Number(tx.amount);
            if (tx.type === 'expense') {
              signPrefix = '−';
              showAbs = Math.abs(Number(tx.amount));
            } else if (tx.type === 'income') {
              signPrefix = '+';
              showAbs = Math.abs(Number(tx.amount));
            } else if (tx.type === 'balance_update') {
              const d = Number(tx.amount);
              signPrefix = d >= 0 ? '+' : '−';
              showAbs = Math.abs(d);
            } else {
              signPrefix = '';
              showAbs = Math.abs(Number(tx.amount));
            }

            const icon = categoryIcon(tx.category, tx.type);
            const rowAccId = tx.runningBalanceAccountId ? String(tx.runningBalanceAccountId) : '';
            const rowBal =
              tx.accountRunningBalance != null && !Number.isNaN(Number(tx.accountRunningBalance))
                ? Number(tx.accountRunningBalance)
                : Number(tx.runningBalance);
            const rowAccName = rowAccId ? accountsById[rowAccId]?.name || 'Account' : '';

            return (
              <li key={tx._id} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                <SwipeableRow onEdit={() => setEditTx(tx)} onDelete={() => deleteTx(tx)}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="tx-row-v2"
                    onClick={() => setEditTx(tx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditTx(tx);
                      }
                    }}
                  >
                    <div className="tx-icon-tile" aria-hidden>
                      {icon}
                    </div>
                    <div className="tx-v2-body">
                      <div className="tx-v2-title">{txTitle(tx)}</div>
                      <div className="tx-v2-meta">{txSubtitle(tx, accountsById)}</div>
                    </div>
                    <div className="tx-v2-right">
                      <div className={`tx-v2-amt ${cls}`}>
                        {signPrefix}
                        {formatMoney(showAbs)}
                      </div>
                      <div className="tx-v2-bal">
                        bal {formatMoney(rowBal)}
                        {rowAccName ? ` · ${rowAccName}` : ''}
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              </li>
            );
          })}
        </ul>
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
