import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';
import * as storage from './storage';

type User = {
  _id: string;
  username: string;
  email?: string;
  phone_no?: string;
  country_code?: string;
  avatar?: string;
  address?: Record<string, string>;
  settings?: Record<string, unknown>;
  role?: string;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  booting: boolean;
  login: (country_code: string, phone_no: string, password: string) => Promise<void>;
  register: (payload: Record<string, unknown>) => Promise<void>;
  adoptSession: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  updateLocalUser: (user: User) => void;
};

const TOKEN_KEY = 'violet_token';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const persistSession = useCallback(async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    await storage.setItem(TOKEN_KEY, nextToken);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await storage.deleteItem(TOKEN_KEY);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const data = await api.me(token);
    if (data?.user) setUser(data.user);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await storage.getItem(TOKEN_KEY);
        if (!saved || cancelled) {
          if (!cancelled) setBooting(false);
          return;
        }
        const data = await api.me(saved);
        if (cancelled) return;
        if (data?.user) {
          setToken(saved);
          setUser(data.user);
        } else {
          await storage.deleteItem(TOKEN_KEY);
        }
      } catch {
        await storage.deleteItem(TOKEN_KEY).catch(() => undefined);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (country_code: string, phone_no: string, password: string) => {
      const data = await api.login({ country_code, phone_no, password });
      if (!data?.token || !data?.user) throw new Error(data?.msg || 'Login failed');
      await persistSession(data.token, data.user);
    },
    [persistSession],
  );

  const register = useCallback(
    async (payload: Record<string, unknown>) => {
      const data = await api.register(payload);
      if (!data?.token || !data?.user) throw new Error(data?.msg || 'Register failed');
      await persistSession(data.token, data.user);
    },
    [persistSession],
  );

  const adoptSession = useCallback(
    async (nextToken: string, nextUser: User) => {
      await persistSession(nextToken, nextUser);
    },
    [persistSession],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      login,
      register,
      adoptSession,
      logout,
      refreshMe,
      updateLocalUser: setUser,
    }),
    [user, token, booting, login, register, adoptSession, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
