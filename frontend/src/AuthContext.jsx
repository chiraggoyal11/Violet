import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, wakeApi } from './api';

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
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const persist = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser }),
    );
  }, []);

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
      } catch (err) {
        // Keep the local session on transient/rate-limit failures so checkout
        // and other pages are not bounced to login mid-flow.
        const msg = String(err?.message || '').toLowerCase();
        const keepSession =
          msg.includes('too many requests') ||
          msg.includes('rate') ||
          msg.includes('network') ||
          msg.includes('failed to fetch');
        if (!cancelled && !keepSession) {
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

  const setUserSession = useCallback(
    (nextToken, nextUser) => {
      persist(nextToken, nextUser);
    },
    [persist],
  );

  const updateLocalUser = useCallback((nextUser) => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    setUser(nextUser);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: currentToken, user: nextUser }),
    );
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loginWithGoogle = useCallback(
    async (credential) => {
      await wakeApi();
      const data = await api.loginWithGoogle(credential);
      if (!data.success) throw new Error(data.msg || 'Google sign-in failed');
      persist(data.token, data.user);
      return data;
    },
    [persist],
  );

  const login = useCallback(
    async (country_code, phone_no, password) => {
      await wakeApi();
      const data = await api.login({ country_code, phone_no, password });
      if (!data.success) throw new Error(data.msg || 'Login failed');
      persist(data.token, data.user);
      return data;
    },
    [persist],
  );

  const register = useCallback(
    async (username, country_code, phone_no, password, email = '') => {
      await wakeApi();
      const payload = { username, country_code, phone_no, password };
      if (email) payload.email = email;
      const data = await api.register(payload);
      if (!data.success) throw new Error(data.msg || 'Registration failed');
      persist(data.token, data.user);
      return data;
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      booting,
      setUserSession,
      updateLocalUser,
      loginWithGoogle,
      login,
      register,
      logout,
    }),
    [
      token,
      user,
      booting,
      setUserSession,
      updateLocalUser,
      loginWithGoogle,
      login,
      register,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
