import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { browserOnline, isOfflineFetchError } from '../offline/networkState.js';

const AuthContext = createContext(null);
const USER_CACHE_KEY = 'spendly_user';

function readCachedUser() {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY) || localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUser(profile) {
  const raw = JSON.stringify(profile);
  sessionStorage.setItem(USER_CACHE_KEY, raw);
  localStorage.setItem(USER_CACHE_KEY, raw);
}

function clearCachedUser() {
  sessionStorage.removeItem(USER_CACHE_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
}

function normalizeProfile(u) {
  return {
    id: u._id || u.id,
    name: u.name,
    email: u.email,
    emailPreferences: {
      monthlyStatement: u?.emailPreferences?.monthlyStatement !== false,
      expenseReminder: u?.emailPreferences?.expenseReminder !== false,
      pendingDebtReminder: u?.emailPreferences?.pendingDebtReminder !== false,
      welcomeSignup: u?.emailPreferences?.welcomeSignup !== false,
    },
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('spendly_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        const profile = normalizeProfile(u);
        writeCachedUser(profile);
        setUser(profile);
      })
      .catch((e) => {
        if (e?.status === 401) {
          localStorage.removeItem('spendly_token');
          clearCachedUser();
          setUser(null);
          return;
        }
        if (token && (!browserOnline() || isOfflineFetchError(e))) {
          const cached = readCachedUser();
          if (cached) {
            setUser(cached);
            return;
          }
        }
        // Keep token for transient/network issues; only 401 should force logout.
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem('spendly_token', data.token);
    const me = await api.me();
    const profile = normalizeProfile(me);
    writeCachedUser(profile);
    setUser(profile);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await api.register({ name, email, password });
    localStorage.setItem('spendly_token', data.token);
    const me = await api.me();
    const profile = normalizeProfile(me);
    writeCachedUser(profile);
    setUser(profile);
    return data;
  };

  const updateEmailPreferences = async (patch) => {
    const data = await api.updateEmailPreferences(patch);
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        emailPreferences: {
          ...prev.emailPreferences,
          ...data.emailPreferences,
        },
      };
      writeCachedUser(next);
      return next;
    });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('spendly_token');
    clearCachedUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateEmailPreferences }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
