import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '../lib/apiClient';
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/authStorage';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
}

interface SessionInfo {
  user: AuthUser;
  expiresAt: number;
  warningAt: number;
  sessionDurationMs: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  logoutMessage: string | null;
  showSessionWarning: boolean;
  secondsRemaining: number;
  login: (login: string, password: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
  extendSession: () => Promise<void>;
  dismissSessionWarning: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(session: SessionInfo & { token?: string }) {
  if (session.token) {
    setAuthToken(session.token);
  }
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const logoutRef = useRef<(message?: string) => Promise<void>>(async () => {});

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(async (message = 'Logging out...') => {
    clearTimers();
    setShowSessionWarning(false);
    setIsLoggingOut(true);
    setLogoutMessage(message);

    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore network errors during logout */
    }

    clearAuthToken();

    await new Promise((resolve) => window.setTimeout(resolve, 1800));

    setUser(null);
    setIsLoggingOut(false);
    setLogoutMessage(null);
  }, [clearTimers]);

  logoutRef.current = logout;

  const scheduleSessionTimers = useCallback((session: SessionInfo) => {
    clearTimers();
    setShowSessionWarning(false);

    const now = Date.now();
    const warningDelay = Math.max(session.warningAt - now, 0);
    const logoutDelay = Math.max(session.expiresAt - now, 0);

    warningTimerRef.current = window.setTimeout(() => {
      setShowSessionWarning(true);
      setSecondsRemaining(Math.max(Math.ceil((session.expiresAt - Date.now()) / 1000), 0));

      countdownTimerRef.current = window.setInterval(() => {
        const remaining = Math.max(Math.ceil((session.expiresAt - Date.now()) / 1000), 0);
        setSecondsRemaining(remaining);
        if (remaining <= 0 && countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }, 1000);
    }, warningDelay);

    logoutTimerRef.current = window.setTimeout(() => {
      void logoutRef.current('Logging out...');
    }, logoutDelay);
  }, [clearTimers]);

  const hydrateSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/auth/me');
      if (!res.ok) {
        clearAuthToken();
        setIsLoading(false);
        return;
      }

      const session = applySession(await res.json() as SessionInfo);
      setUser(session.user);
      scheduleSessionTimers(session);
    } catch {
      clearAuthToken();
    } finally {
      setIsLoading(false);
    }
  }, [scheduleSessionTimers]);

  useEffect(() => {
    void hydrateSession();
    return clearTimers;
  }, [hydrateSession, clearTimers]);

  useEffect(() => {
    const onExpired = () => {
      void logout('Session expired. Logging out...');
    };

    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  const login = useCallback(async (loginValue: string, password: string) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: loginValue, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(data.error || 'Login failed');
    }

    const session = applySession(await res.json() as SessionInfo & { token: string });
    setUser(session.user);
    scheduleSessionTimers(session);
  }, [scheduleSessionTimers]);

  const extendSession = useCallback(async () => {
    const res = await apiFetch('/auth/extend', { method: 'POST' });
    if (!res.ok) {
      throw new Error('Unable to extend session');
    }

    const session = await res.json() as SessionInfo;
    setShowSessionWarning(false);
    scheduleSessionTimers(session);
  }, [scheduleSessionTimers]);

  const dismissSessionWarning = useCallback(async () => {
    setShowSessionWarning(false);
    await logout('Logging out...');
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isLoggingOut,
    logoutMessage,
    showSessionWarning,
    secondsRemaining,
    login,
    logout,
    extendSession,
    dismissSessionWarning,
  }), [
    user,
    isLoading,
    isLoggingOut,
    logoutMessage,
    showSessionWarning,
    secondsRemaining,
    login,
    logout,
    extendSession,
    dismissSessionWarning,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
