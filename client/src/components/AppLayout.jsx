import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { browserOnline } from '../offline/networkState.js';
import { drainOutbox } from '../offline/sync.js';
import { outboxCount } from '../offline/store.js';

export default function AppLayout() {
  const [online, setOnline] = useState(() => browserOnline());
  const [syncNote, setSyncNote] = useState('');

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

  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <div className="card desktop-rail-brand">
          <strong className="desktop-rail-title">Spendly</strong>
          <p className="desktop-rail-tagline">Money tracker</p>
        </div>
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
          <span className="nav-icon">🏠</span>
          Home
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">📊</span>
          Stats
        </NavLink>
        <NavLink to="/accounts" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">💳</span>
          Accounts
        </NavLink>
        <NavLink to="/pending" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">🧾</span>
          Debts
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">👤</span>
          Me
        </NavLink>
      </nav>
    </div>
  );
}
