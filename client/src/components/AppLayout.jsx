import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <div className="card" style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: '1.1rem' }}>Spendly</strong>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>{user?.name}</p>
          <button type="button" className="btn btn-ghost" style={{ marginTop: 12, width: '100%' }} onClick={logout}>
            Log out
          </button>
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
        </nav>
      </aside>
      <div className="main-panel">
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
      </nav>
    </div>
  );
}
