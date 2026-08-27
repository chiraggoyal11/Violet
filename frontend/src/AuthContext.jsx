import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'violet_auth';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').token || null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').user || null;
    } catch {
      return null;
    }
  });
  const [booting, setBooting] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await api.me(token);
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo(() => {
    function persist(nextToken, nextUser) {
      setToken(nextToken);
      setUser(nextUser);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: nextToken, user: nextUser }),
      );
    }

    return {
      token,
      user,
      booting,
      setUserSession(nextToken, nextUser) {
        persist(nextToken, nextUser);
      },
      async login(phone_no, password) {
        const data = await api.login({ phone_no, password });
        if (!data.success) throw new Error(data.msg || 'Login failed');
        persist(data.token, data.user);
        return data;
      },
      async register(username, phone_no, password, email = '') {
        const payload = { username, phone_no, password };
        if (email) payload.email = email;
        const data = await api.register(payload);
        if (!data.success) throw new Error(data.msg || 'Registration failed');
        persist(data.token, data.user);
        return data;
      },
      logout() {
        setToken(null);
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    };
  }, [token, user, booting]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
