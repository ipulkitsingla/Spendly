import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { browserOnline, isOfflineFetchError } from '../offline/networkState.js';

const AuthContext = createContext(null);

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
        const profile = { id: u._id || u.id, name: u.name, email: u.email };
        sessionStorage.setItem('spendly_user', JSON.stringify(profile));
        setUser(profile);
      })
      .catch((e) => {
        if (e?.status === 401) {
          localStorage.removeItem('spendly_token');
          sessionStorage.removeItem('spendly_user');
          setUser(null);
          return;
        }
        if (token && (!browserOnline() || isOfflineFetchError(e))) {
          try {
            const raw = sessionStorage.getItem('spendly_user');
            if (raw) {
              setUser(JSON.parse(raw));
              return;
            }
          } catch {
            /* ignore */
          }
        }
        localStorage.removeItem('spendly_token');
        sessionStorage.removeItem('spendly_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login({ email, password });
    localStorage.setItem('spendly_token', data.token);
    const profile = { id: data.user.id, name: data.user.name, email: data.user.email };
    sessionStorage.setItem('spendly_user', JSON.stringify(profile));
    setUser(profile);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await api.register({ name, email, password });
    localStorage.setItem('spendly_token', data.token);
    const profile = { id: data.user.id, name: data.user.name, email: data.user.email };
    sessionStorage.setItem('spendly_user', JSON.stringify(profile));
    setUser(profile);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('spendly_token');
    sessionStorage.removeItem('spendly_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
