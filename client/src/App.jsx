import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AppLayout from './components/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StatsPage from './pages/StatsPage.jsx';
import AccountsPage from './pages/AccountsPage.jsx';
import PendingPage from './pages/PendingPage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-screen">
        <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={!loading && user ? <Navigate to="/" replace /> : <Register />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="pending" element={<PendingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
