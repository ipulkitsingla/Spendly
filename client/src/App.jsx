import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { PrivacyProvider } from './context/PrivacyContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { APP_VERSION } from './utils/appMeta.js';

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const AccountsPage = lazy(() => import('./pages/AccountsPage.jsx'));
const PendingPage = lazy(() => import('./pages/PendingPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));

function Loading() {
  return (
    <div className="auth-screen">
      <div className="loader-container">
        <div className="loader" />
        <p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 12 }}>Loading Spendly…</p>
      </div>
      <p className="app-version-loading">{APP_VERSION}</p>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <>
      <ThemeToggle />
      <Suspense fallback={<Loading />}>
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
                <PrivacyProvider>
                  <AppLayout />
                </PrivacyProvider>
              </Protected>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="pending" element={<PendingPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
