import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePrivacy } from '../context/PrivacyContext.jsx';
import { formatMonthLong } from '../utils/dates.js';
import { formatDay, formatMoney, formatTxTime, monthKey, shiftMonth } from '../utils/format.js';
import QuickAddFab from '../components/QuickAddFab.jsx';
import TxModals from '../components/TxModals.jsx';
import EditTransactionModal from '../components/EditTransactionModal.jsx';
import SwipeableRow from '../components/SwipeableRow.jsx';
import BiometricOverlay from '../components/BiometricOverlay.jsx';

function CategorySquircleIcon({ category, type }) {
  const cat = (category || '').toLowerCase();

  if (type === 'credit_expense' || type === 'credit_payment') {
    return (
      <div className="fintech-squircle theme-credit">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      </div>
    );
  }

  if (type === 'transfer') {
    return (
      <div className="fintech-squircle theme-transfer">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3L21 7L17 11" />
          <path d="M21 7H3" />
          <path d="M7 21L3 17L7 13" />
          <path d="M3 17H21" />
        </svg>
      </div>
    );
  }

  if (type === 'balance_update') {
    return (
      <div className="fintech-squircle theme-balance">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </svg>
      </div>
    );
  }

  if (
    cat.includes('food') ||
    cat.includes('drink') ||
    cat.includes('noodle') ||
    cat.includes('eat') ||
    cat.includes('restaurant') ||
    cat.includes('cafe') ||
    cat.includes('coffee')
  ) {
    return (
      <div className="fintech-squircle theme-food">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      </div>
    );
  }

  if (
    cat.includes('transport') ||
    cat.includes('travel') ||
    cat.includes('uber') ||
    cat.includes('ola') ||
    cat.includes('car') ||
    cat.includes('fuel') ||
    cat.includes('taxi') ||
    cat.includes('auto')
  ) {
    return (
      <div className="fintech-squircle theme-transport">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="7" rx="2" />
          <path d="M5 11l2-5h10l2 5" />
          <circle cx="7.5" cy="15.5" r="1.5" />
          <circle cx="16.5" cy="15.5" r="1.5" />
        </svg>
      </div>
    );
  }

  if (
    cat.includes('shop') ||
    cat.includes('cloth') ||
    cat.includes('store') ||
    cat.includes('amazon') ||
    cat.includes('cart') ||
    cat.includes('grocer')
  ) {
    return (
      <div className="fintech-squircle theme-shopping">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
    );
  }

  if (
    cat.includes('bill') ||
    cat.includes('rent') ||
    cat.includes('util') ||
    cat.includes('recharge') ||
    cat.includes('elect') ||
    cat.includes('wifi')
  ) {
    return (
      <div className="fintech-squircle theme-bills">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
    );
  }

  if (cat.includes('salary') || type === 'income' || cat.includes('bonus')) {
    return (
      <div className="fintech-squircle theme-salary">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </div>
    );
  }

  return (
    <div className="fintech-squircle theme-default">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
  );
}

function txTitle(tx) {
  if (tx.note && tx.note.trim()) {
    return tx.note.trim();
  }
  if (tx.type === 'transfer') {
    return tx.category || 'Transfer';
  }
  if (tx.type === 'balance_update') {
    return 'Balance update';
  }
  return tx.category || 'Transaction';
}

function txSubtitle(tx, accountsById) {
  const d = new Date(tx.date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = formatTxTime(tx.date);
  const dateStr = isToday ? 'Today' : isYesterday ? 'Yesterday' : formatDay(tx.date);

  if (tx.type === 'transfer' || tx.type === 'credit_payment') {
    const fromName = tx.fromAccountName || accountsById[String(tx.fromAccountId)]?.name || 'Account';
    const toName = tx.toAccountName || accountsById[String(tx.toAccountId)]?.name || 'Account';
    return `${fromName} → ${toName} · ${dateStr} · ${timeStr}`;
  }

  const cat = tx.category || 'General';
  return `${cat} · ${dateStr} · ${timeStr}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    faceLock,
    credentialId,
    registerBiometric,
    lock,
    unveiled,
    biometricReady,
    revealWithBiometric,
    revealWithTap,
    heroBalanceHidden,
    amountsHidden,
  } = usePrivacy();

  const { user, updateBudget } = useAuth();
  const [showBio, setShowBio] = useState(false);
  const [faceErr, setFaceErr] = useState('');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const [searchParams, setSearchParams] = useSearchParams();
  const [month, setMonth] = useState(() => monthKey());
  const [accountFilter, setAccountFilter] = useState(() => searchParams.get('accountId') || '');

  const updateAccountFilter = useCallback(
    (val) => {
      setAccountFilter(val);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (val) p.set('accountId', val);
        else p.delete('accountId');
        return p;
      });
    },
    [setSearchParams]
  );

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [bundle, setBundle] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [err, setErr] = useState('');
  const [incomeHidden, setIncomeHidden] = useState(true);
  const [netHidden, setNetHidden] = useState(true);
  const [walletHidden, setWalletHidden] = useState(false);

  // Check if opened with quickadd param
  useEffect(() => {
    if (searchParams.get('quickadd') === '1') {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('spendly-toggle-quick-add'));
      }, 50);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete('quickadd');
        return p;
      });
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  const loadMeta = useCallback(async () => {
    const [accs, cats, pends] = await Promise.all([
      api.accounts(),
      api.categories(),
      api.pending().catch(() => []),
    ]);
    setAccounts(accs);
    setCategories(cats);
    if (Array.isArray(pends)) {
      setPendingCount(pends.filter((p) => p.status === 'pending').length);
    }
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

  const displayTotal = useMemo(() => {
    if (!accounts.length) return 0;
    if (accountFilter) {
      const a = accounts.find((x) => String(x._id) === String(accountFilter));
      return a ? Number(a.balance) || 0 : 0;
    }
    return accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  }, [accounts, accountFilter]);

  const txs = bundle?.transactions || [];
  const monthIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const budgetOffsetIncome = txs
    .filter((t) => t.type === 'income' && t.category !== 'Salary')
    .reduce((s, t) => s + t.amount, 0);
  const monthCashExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const monthCreditExpense = txs.filter((t) => t.type === 'credit_expense').reduce((s, t) => s + t.amount, 0);
  const totalSpending = monthCashExpense + monthCreditExpense;
  const budgetExpense = txs
    .filter((t) => t.type === 'expense' || t.type === 'credit_expense')
    .reduce((s, t) => s + t.amount, 0);

  const budgetBreakdown = useMemo(() => {
    const cats = {};
    for (const tx of txs) {
      if (tx.type === 'expense' || tx.type === 'credit_expense') {
        cats[tx.category] = (cats[tx.category] || 0) + tx.amount;
      }
      if (tx.type === 'income' && tx.category !== 'Salary') {
        cats[tx.category] = (cats[tx.category] || 0) - tx.amount;
      }
    }
    return Object.entries(cats)
      .filter(([_, amt]) => amt !== 0)
      .sort((a, b) => b[1] - a[1]);
  }, [txs]);

  const monthTitle = formatMonthLong(new Date(month + '-01T12:00:00'));
  const netMonth = monthIncome - monthCashExpense;

  const editTxNormalized = editTx
    ? {
        ...editTx,
        accountId: editTx.accountId ? String(editTx.accountId) : '',
        fromAccountId: editTx.fromAccountId ? String(editTx.fromAccountId) : '',
        toAccountId: editTx.toAccountId ? String(editTx.toAccountId) : '',
      }
    : null;

  // Header dynamic greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 17 ? 'Good afternoon,' : 'Good evening,';
  const userName = user?.name || user?.email?.split('@')[0] || 'User';

  function getCardTheme(card) {
    if (card.isMain) return 'theme-signature-navy';
    const rawType = (card.rawType || '').toLowerCase();
    const name = (card.name || '').toLowerCase();

    if (rawType.includes('credit') || name.includes('credit') || name.includes('card')) {
      return 'theme-obsidian-black';
    }
    if (rawType.includes('cash') || name.includes('cash') || name.includes('wallet')) {
      return 'theme-emerald-frost';
    }
    if (rawType.includes('saving') || name.includes('saving')) {
      return 'theme-sapphire-blue';
    }
    if (rawType.includes('invest') || name.includes('stock') || name.includes('crypto')) {
      return 'theme-amethyst-violet';
    }
    return 'theme-midnight-cobalt';
  }

  // Prepare cards deck for "My Wallet"
  const walletCards = useMemo(() => {
    const totalAll = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const mainCard = {
      id: '',
      name: 'Main wallet',
      rawType: 'main',
      type: 'CASH ACCOUNT',
      balance: totalAll,
      last4: '5678',
      isMain: true,
    };
    const mapped = accounts.map((acc, idx) => ({
      id: String(acc._id),
      name: acc.name,
      rawType: acc.type || 'account',
      type: (acc.type || 'account').toUpperCase() + (acc.type === 'credit' ? ' CARD' : ' ACCOUNT'),
      balance: Number(acc.balance) || 0,
      last4: acc._id ? String(acc._id).slice(-4) : String(5000 + idx),
      isMain: false,
    }));
    return [mainCard, ...mapped];
  }, [accounts]);

  const activeCardIdx = useMemo(() => {
    if (!accountFilter) return 0;
    const idx = walletCards.findIndex((c) => c.id === accountFilter);
    return idx >= 0 ? idx : 0;
  }, [accountFilter, walletCards]);

  const handleCardClick = (targetIdx) => {
    const card = walletCards[targetIdx];
    if (card) {
      updateAccountFilter(card.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }
  };

  // 3D Tilt & Holographic Sheen on Active Card
  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    const py = Math.min(Math.max((y / rect.height) * 100, 0), 100);
    const tiltX = ((px - 50) / 50) * 8;
    const tiltY = ((50 - py) / 50) * 8;
    e.currentTarget.style.setProperty('--sheen-x', `${px}%`);
    e.currentTarget.style.setProperty('--sheen-y', `${py}%`);
    e.currentTarget.style.setProperty('--tilt-x', `${tiltX}deg`);
    e.currentTarget.style.setProperty('--tilt-y', `${tiltY}deg`);
  };

  const handleCardMouseLeave = (e) => {
    e.currentTarget.style.setProperty('--sheen-x', '50%');
    e.currentTarget.style.setProperty('--sheen-y', '50%');
    e.currentTarget.style.setProperty('--tilt-x', '0deg');
    e.currentTarget.style.setProperty('--tilt-y', '0deg');
  };

  // Touch Swipe Carousel Navigation
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e) => {
    if (touchStartX === null || touchStartY === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
      setTouchDeltaX(dx);
    }
  };

  const handleTouchEnd = () => {
    if (touchDeltaX < -40) {
      const nextIdx = (activeCardIdx + 1) % walletCards.length;
      handleCardClick(nextIdx);
    } else if (touchDeltaX > 40) {
      const prevIdx = (activeCardIdx - 1 + walletCards.length) % walletCards.length;
      handleCardClick(prevIdx);
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchDeltaX(0);
  };

  const isBalanceHidden = heroBalanceHidden || amountsHidden;

  return (
    <div className="fintech-dashboard">
      {showBio && (
        <BiometricOverlay
          onComplete={() => {
            setShowBio(false);
            revealWithBiometric().catch(() => {});
          }}
        />
      )}

      {/* TOP GREETING & HEADER ACTIONS */}
      <header className="fintech-home-header">
        <div className="fintech-greeting-col">
          <span className="fintech-greeting-sub">{greeting}</span>
          <h1 className="fintech-greeting-name">{userName} 👋</h1>
        </div>
        <div className="fintech-header-actions">
          <button
            type="button"
            className="fintech-bell-btn"
            aria-label="Pending reminders and debts"
            onClick={() => navigate('/pending')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {pendingCount > 0 && (
              <span className="fintech-bell-badge">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="fintech-avatar-btn"
            aria-label="User profile"
            onClick={() => navigate('/profile')}
          >
            <div className="fintech-avatar-img">
              {userName.charAt(0).toUpperCase()}
            </div>
          </button>
        </div>
      </header>

      {/* TOTAL BALANCE SECTION */}
      <section className="fintech-balance-section">
        <span className="fintech-balance-label">Total Balance</span>
        <div className="fintech-balance-row">
          <div className="fintech-balance-amount">
            {isBalanceHidden ? (
              <span className="fintech-balance-masked">₹ ••••••</span>
            ) : (
              <span className="fintech-balance-val">{formatMoney(displayTotal)}</span>
            )}
          </div>
          <button
            type="button"
            className="fintech-eye-btn"
            aria-label={isBalanceHidden ? 'Reveal balance' : 'Hide balance'}
            onClick={async () => {
              if (isBalanceHidden) {
                if (faceLock && credentialId) {
                  setShowBio(true);
                } else {
                  revealWithTap();
                }
              } else {
                lock();
              }
            }}
          >
            {isBalanceHidden ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Security / Biometric Quick Enable if not enrolled */}
        {!faceLock || !credentialId ? (
          biometricReady && (
            <button
              type="button"
              className="fintech-biometric-prompt"
              onClick={async () => {
                setFaceErr('');
                try {
                  await registerBiometric();
                } catch (e) {
                  setFaceErr(e.message || 'Could not enable Face Lock');
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Enable Biometric Lock</span>
            </button>
          )
        ) : null}

        {faceErr && (
          <p className="fintech-error-hint" role="alert">
            {faceErr}
          </p>
        )}
      </section>

      {/* MONTH BAR NAVIGATION */}
      <div className="fintech-month-pill-wrap">
        <div className="fintech-month-pill">
          <button
            type="button"
            className="fintech-month-nav-btn"
            aria-label="Previous month"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ‹
          </button>
          <span className="fintech-month-title">{monthTitle}</span>
          <button
            type="button"
            className="fintech-month-nav-btn"
            aria-label="Next month"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            ›
          </button>
        </div>
      </div>

      {/* MY WALLET (CARDS DECK) */}
      <section className="fintech-wallet-section">
        <div className="fintech-wallet-header">
          <h2 className="fintech-wallet-title">My Wallet</h2>
          <div className="fintech-wallet-controls">
            <button
              type="button"
              className="fintech-icon-pill-btn"
              aria-label="Add transaction"
              title="Add transaction (+)"
              onClick={() => {
                setModal('expense');
                setModalData(null);
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              className="fintech-icon-pill-btn"
              aria-label={walletHidden ? 'Show card balances' : 'Hide card balances'}
              onClick={() => setWalletHidden((v) => !v)}
            >
              {walletHidden ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="fintech-icon-pill-btn"
              aria-label="Manage accounts"
              onClick={() => navigate('/accounts')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* 3D Stacked Card Deck with Touch Gestures and Holographic Sheen */}
        <div
          className="fintech-card-deck-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="fintech-card-deck">
            {walletCards.map((card, idx) => {
              const isCurrent = idx === activeCardIdx;
              const isNext1 = idx === (activeCardIdx + 1) % walletCards.length && walletCards.length > 1;
              const isNext2 = idx === (activeCardIdx + 2) % walletCards.length && walletCards.length > 2;

              let cardClass = 'fintech-card-inactive';
              if (isCurrent) cardClass = 'fintech-card-active';
              else if (isNext1) cardClass = 'fintech-card-next-1';
              else if (isNext2) cardClass = 'fintech-card-next-2';

              const themeClass = getCardTheme(card);

              return (
                <div
                  key={card.id || 'main'}
                  className={`fintech-card ${cardClass} ${themeClass}`}
                  onClick={() => handleCardClick(idx)}
                  onMouseMove={isCurrent ? handleCardMouseMove : undefined}
                  onMouseLeave={isCurrent ? handleCardMouseLeave : undefined}
                  style={
                    isCurrent && touchDeltaX !== 0
                      ? { transform: `translateX(${touchDeltaX * 0.3}px) scale(1)` }
                      : undefined
                  }
                >
                  <div className="fintech-card-sheen" />
                  <div className="fintech-card-foil-edge" />
                  <div className="fintech-card-inner">
                    <div className="fintech-card-top">
                      <div className="fintech-card-shield-badge">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>{card.name}</span>
                      </div>
                      <div className="fintech-card-top-right">
                        <div className="fintech-card-emv-chip" title="EMV Smart Chip">
                          <div className="chip-cell" />
                          <div className="chip-cell" />
                        </div>
                        <div className="fintech-card-wifi">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                            <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="fintech-card-mid">
                      <div className="fintech-card-bal">
                        {walletHidden || isBalanceHidden ? (
                          <span className="fintech-card-dots">₹ •••••</span>
                        ) : (
                          <span>{formatMoney(card.balance)}</span>
                        )}
                      </div>
                      <span className="fintech-card-subtitle">{card.type}</span>
                    </div>

                    <div className="fintech-card-bottom">
                      <div className="fintech-card-num">
                        <span className="fintech-card-num-dots">•••• ••••</span>
                        <span className="fintech-card-num-digits">5274 {card.last4}</span>
                      </div>
                      <div className="fintech-card-brand">
                        <div className="mc-circle mc-left" />
                        <div className="mc-circle mc-right" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Indicator Dots */}
          <div className="fintech-card-dots-bar">
            {walletCards.map((card, idx) => (
              <button
                key={card.id || 'dot-main'}
                type="button"
                className={`fintech-nav-dot ${idx === activeCardIdx ? 'active' : ''}`}
                aria-label={`Select ${card.name}`}
                onClick={() => handleCardClick(idx)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SUMMARY STATS STRIP & BUDGET SECTION */}
      <section className="fintech-metrics-section">
        <div className="fintech-summary-strip">
          <div className="fintech-summary-stat">
            <div className="fintech-summary-label-row">
              <span>Income</span>
              <button
                type="button"
                className="fintech-mini-eye-btn"
                aria-label={incomeHidden ? 'Show income' : 'Hide income'}
                onClick={() => setIncomeHidden((v) => !v)}
              >
                {incomeHidden ? '•' : '👁'}
              </button>
            </div>
            <strong className={`type-income ${incomeHidden ? 'fintech-stat-masked' : ''}`}>
              {incomeHidden ? '******' : formatMoney(monthIncome)}
            </strong>
          </div>

          <div className="fintech-summary-stat">
            <span className="fintech-summary-label">Spending</span>
            <strong className="type-expense">{formatMoney(totalSpending)}</strong>
          </div>

          <div className="fintech-summary-stat">
            <div className="fintech-summary-label-row">
              <span>Cash Flow</span>
              <button
                type="button"
                className="fintech-mini-eye-btn"
                aria-label={netHidden ? 'Show net' : 'Hide net'}
                onClick={() => setNetHidden((v) => !v)}
              >
                {netHidden ? '•' : '👁'}
              </button>
            </div>
            <strong className={`type-net ${netHidden ? 'fintech-stat-masked' : ''}`}>
              {netHidden ? '******' : formatMoney(netMonth)}
            </strong>
          </div>
        </div>

        {/* Monthly Budget Card */}
        {user?.monthlyBudget > 0 && !accountFilter && (
          <div className="fintech-budget-card" onClick={() => setShowBudgetBreakdown(true)}>
            <div className="fintech-budget-header">
              <span>Monthly Budget</span>
              <span className={`fintech-budget-pct ${budgetExpense - budgetOffsetIncome > user.monthlyBudget ? 'over' : ''}`}>
                {Math.round((Math.max(0, budgetExpense - budgetOffsetIncome) / user.monthlyBudget) * 100)}% spent
              </span>
            </div>
            <div className="fintech-budget-track">
              <div
                className={`fintech-budget-fill ${budgetExpense - budgetOffsetIncome > user.monthlyBudget ? 'over' : ''}`}
                style={{
                  width: `${Math.min(100, (Math.max(0, budgetExpense - budgetOffsetIncome) / user.monthlyBudget) * 100)}%`,
                }}
              />
            </div>
            <div className="fintech-budget-footer">
              <span>
                {formatMoney(Math.max(0, budgetExpense - budgetOffsetIncome))} of {formatMoney(user.monthlyBudget)}
              </span>
              <span className={budgetExpense - budgetOffsetIncome > user.monthlyBudget ? 'type-expense' : 'type-income'}>
                {user.monthlyBudget - (budgetExpense - budgetOffsetIncome) > 0
                  ? `${formatMoney(user.monthlyBudget - (budgetExpense - budgetOffsetIncome))} left`
                  : `${formatMoney(budgetExpense - budgetOffsetIncome - user.monthlyBudget)} over`}
              </span>
            </div>
          </div>
        )}

        {!user?.monthlyBudget && !accountFilter && (
          <div
            className="fintech-budget-empty-card"
            onClick={() => {
              setBudgetInput('');
              setShowBudgetModal(true);
            }}
          >
            <span>Set a monthly budget goal</span>
            <button type="button" className="fintech-budget-set-btn">
              Set Budget
            </button>
          </div>
        )}
      </section>

      {err && <p className="fintech-page-err">{err}</p>}

      {/* LATEST TRANSACTIONS SECTION */}
      <section className="fintech-tx-section">
        <div className="fintech-tx-header">
          <h2 className="fintech-tx-title">
            Transactions
            {txs.length > 0 && <span className="fintech-tx-count-pill">{txs.length}</span>}
          </h2>
          <div className="fintech-tx-header-actions">
            <button
              type="button"
              className="fintech-add-btn"
              aria-label="Add Transaction"
              title="Add Transaction (+)"
              onClick={() => {
                setModal('expense');
                setModalData(null);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add</span>
            </button>
            <button
              type="button"
              className="fintech-see-all-btn"
              onClick={() => navigate('/search')}
            >
              See all
            </button>
          </div>
        </div>

        {txs.length === 0 ? (
          <div className="fintech-empty-card">
            <p>No transactions this month.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                setModal('expense');
                setModalData(null);
              }}
            >
              + Add Transaction
            </button>
          </div>
        ) : (
          <ul className="fintech-tx-list">
            {txs.map((tx) => {
              const isExpense = tx.type === 'expense' || tx.type === 'credit_expense';
              const isIncome = tx.type === 'income';
              const isBalUpdate = tx.type === 'balance_update';

              let signPrefix = '';
              let amtCls = 'expense';
              let showAbs = Math.abs(Number(tx.amount));

              if (isExpense) {
                signPrefix = '− ';
                amtCls = 'expense';
              } else if (isIncome) {
                signPrefix = '+ ';
                amtCls = 'income';
              } else if (isBalUpdate) {
                const d = Number(tx.amount);
                signPrefix = d >= 0 ? '+ ' : '− ';
                amtCls = d >= 0 ? 'income' : 'expense';
              } else {
                amtCls = 'neutral';
              }

              const title = txTitle(tx);
              const subtitle = txSubtitle(tx, accountsById);

              return (
                <li key={tx._id} className="fintech-tx-item-wrap">
                  <SwipeableRow onEdit={() => setEditTx(tx)} onDelete={() => deleteTx(tx)}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="fintech-tx-row"
                      onClick={() => setEditTx(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setEditTx(tx);
                        }
                      }}
                    >
                      <CategorySquircleIcon category={tx.category} type={tx.type} />
                      <div className="fintech-tx-details">
                        <span className="fintech-tx-name">{title}</span>
                        <span className="fintech-tx-meta">{subtitle}</span>
                      </div>
                      <div className="fintech-tx-right">
                        <span className={`fintech-tx-amount ${amtCls}`}>
                          {signPrefix}
                          {formatMoney(showAbs)}
                        </span>
                        {tx.accountRunningBalance != null && (
                          <span className="fintech-tx-bal">
                            Bal: {formatMoney(tx.accountRunningBalance)}
                          </span>
                        )}
                      </div>

                    </div>
                  </SwipeableRow>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* QUICK ADD FAB (INTEGRATED WITH CENTER BOTTOM NAV BUTTON) */}
      <QuickAddFab onPick={setModal} />

      {/* TRANSACTION CREATION MODALS */}
      <TxModals
        key={modal ? `${modal}-${modalData?.category || ''}` : 'closed'}
        mode={modal}
        defaultCategory={modalData?.category}
        onClose={() => {
          setModal(null);
          setModalData(null);
        }}
        accounts={accounts}
        categories={categories}
        onSaved={refresh}
      />

      {/* EDIT TRANSACTION MODAL */}
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

      {/* BUDGET MODAL */}
      {showBudgetModal && (
        <div className="modal-backdrop" onClick={() => setShowBudgetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Monthly Budget</h3>
              <button type="button" className="btn-close" onClick={() => setShowBudgetModal(false)}>
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updateBudget(Number(budgetInput));
                  setShowBudgetModal(false);
                } catch (e) {
                  alert(e.message);
                }
              }}
            >
              <div className="form-group" style={{ padding: '16px 0' }}>
                <label className="label">Monthly Spending Limit</label>
                <input
                  autoFocus
                  type="number"
                  className="input"
                  placeholder="e.g. 50000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                />
                <p className="hint" style={{ marginTop: 8 }}>
                  Track your spending progress against this goal.
                </p>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowBudgetModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BUDGET BREAKDOWN MODAL */}
      {showBudgetBreakdown && (
        <div className="modal-backdrop" onClick={() => setShowBudgetBreakdown(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Budget Breakdown</h3>
              <button type="button" className="btn-close" onClick={() => setShowBudgetBreakdown(false)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: '16px 0', maxHeight: '50vh', overflowY: 'auto' }}>
              {budgetBreakdown.length === 0 ? (
                <p className="empty" style={{ margin: 0 }}>
                  No spending yet this month.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {budgetBreakdown.map(([cat, amt]) => (
                    <li
                      key={cat}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CategorySquircleIcon category={cat} type="expense" />
                        <span style={{ fontWeight: 600 }}>{cat}</span>
                      </div>
                      <strong className={amt > 0 ? 'type-expense' : 'type-income'}>
                        {amt > 0 ? '− ' : '+ '}
                        {formatMoney(Math.abs(amt))}
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setShowBudgetBreakdown(false);
                  setBudgetInput(user?.monthlyBudget?.toString() || '');
                  setShowBudgetModal(true);
                }}
              >
                Edit Budget Amount
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowBudgetBreakdown(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

