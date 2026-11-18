import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { browserOnline } from '../offline/networkState.js';
import { drainOutbox } from '../offline/sync.js';
import { outboxCount } from '../offline/store.js';

export default function AppLayout() {
  const [online, setOnline] = useState(() => browserOnline());
  const [syncNote, setSyncNote] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const sync = () => {
      if (!browserOnline()) return;
      outboxCount().then((n) => {
        if (n <= 0) return;
        setSyncNote('Saving offline changes…');
        drainOutbox()
          .then((r) => {
            if (!r.ok) setSyncNote('Some changes could not save. Open the app when online to retry.');
            else setSyncNote('');
          })
          .catch(() => setSyncNote(''));
      });
    };
    const up = () => {
      setOnline(browserOnline());
      if (browserOnline()) sync();
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    sync();
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', up);
    };
  }, []);

  useEffect(() => {
    if (!syncNote) return undefined;
    const t = setTimeout(() => setSyncNote(''), 5000);
    return () => clearTimeout(t);
  }, [syncNote]);

  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    const onToggle = () => setQuickAddOpen((v) => !v);
    const onOpen = () => setQuickAddOpen(true);
    const onClose = () => setQuickAddOpen(false);
    window.addEventListener('spendly-toggle-quick-add', onToggle);
    window.addEventListener('spendly-open-quick-add', onOpen);
    window.addEventListener('spendly-close-quick-add', onClose);
    return () => {
      window.removeEventListener('spendly-toggle-quick-add', onToggle);
      window.removeEventListener('spendly-open-quick-add', onOpen);
      window.removeEventListener('spendly-close-quick-add', onClose);
    };
  }, []);

  const handleCenterPlusClick = () => {
    const isHome = location.pathname === '/' || location.pathname === '';
    if (isHome) {
      window.dispatchEvent(new CustomEvent('spendly-toggle-quick-add'));
    } else {
      navigate('/?quickadd=1');
    }
  };

  return (
    <div className="app-shell">
      <div className="ambient-bg">
        <div className="blob blob--1" />
        <div className="blob blob--2" />
        <div className="blob blob--3" />
      </div>
      <aside className="desktop-rail">
        <div className="card desktop-rail-brand">
          <strong className="desktop-rail-title">Spendly</strong>
          <p className="desktop-rail-tagline">Money tracker</p>
        </div>
        <button
          type="button"
          className="desktop-rail-add-btn"
          aria-label="Add Transaction"
          onClick={handleCenterPlusClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Transaction</span>
        </button>
        <nav className="desktop-nav">
          <NavLink end to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>🏠</span> Home
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>📊</span> Statistics
          </NavLink>
          <NavLink to="/accounts" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>💳</span> Accounts
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>🔍</span> Search
          </NavLink>
          <NavLink to="/pending" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>🧾</span> Pending
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>👤</span> Profile
          </NavLink>
        </nav>
      </aside>
      <div className="main-panel">
        {(!online || syncNote) && (
          <div className={`offline-bar${online ? ' offline-bar--sync' : ''}`} role="status">
            {!online && <span>You are offline — edits are stored on this device and sync when you reconnect.</span>}
            {online && syncNote && <span>{syncNote}</span>}
          </div>
        )}
        <Outlet />
      </div>
      <nav className="bottom-nav">
        <NavLink end to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
              <polyline points="9 21 9 12 15 12 15 21" />
            </svg>
          </span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <span>Analytics</span>
        </NavLink>
        <NavLink to="/accounts" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </span>
          <span>Accounts</span>
        </NavLink>
        <NavLink to="/pending" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </span>
          <span>Debts</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
