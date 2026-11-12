import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError } from './api';
import { AUTH_STORAGE_KEY, EMPTY_AUTH, authenticatedState, parseSavedAuth } from './authStorage';
import type { User } from '../types';

export function useAuthSession() {
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setStatus('checking');
    setAuth(EMPTY_AUTH);
    const restore = async () => {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        const saved = parseSavedAuth(raw);
        if (!saved.token) {
          if (raw) localStorage.removeItem(AUTH_STORAGE_KEY);
          if (current === generation.current) setStatus('ready');
          return;
        }
        timeout = setTimeout(() => controller.abort(), 12_000);
        const user = await api.getSession(controller.signal);
        if (current !== generation.current || controller.signal.aborted) return;
        const restored = authenticatedState(user, saved.token);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(restored));
        setAuth(restored);
        setStatus('ready');
      } catch (error) {
        if (current !== generation.current) return;
        if (error instanceof ApiRequestError && error.status === 401) {
          setAuth(EMPTY_AUTH);
          setStatus('ready');
        } else {
          // Offline, timeout and 5xx are not proof of an expired session.
          // Keep the saved token, but do not expose protected data until verified.
          setStatus('unavailable');
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    void restore();
    return () => {
      ++generation.current;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  useEffect(() => {
    const expired = () => {
      ++generation.current;
      setAuth(EMPTY_AUTH);
      setStatus('ready');
    };
    const changed = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY || event.key === null) retry();
    };
    const online = () => {
      if (status === 'unavailable') retry();
    };
    window.addEventListener('praticosys:session-expired', expired);
    window.addEventListener('storage', changed);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('praticosys:session-expired', expired);
      window.removeEventListener('storage', changed);
      window.removeEventListener('online', online);
    };
  }, [retry, status]);

  const handleLogin = (userWithToken: User & { sessionToken?: string }) => {
    const { sessionToken, ...user } = userWithToken;
    const next = authenticatedState(user, sessionToken ?? '');
    // Fail explicitly if the browser refuses persistence, rather than pretending
    // the login was saved while API calls cannot read its token.
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    ++generation.current;
    setAuth(next);
    setStatus('ready');
  };

  const handleLogout = () => {
    // Capture the current bearer before clearing it. Never wait for a slow/offline
    // server to finish before removing local access.
    const pending = api.logout();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    ++generation.current;
    setAuth(EMPTY_AUTH);
    setStatus('ready');
    // A failed remote revocation is visible, but must not restore local access.
    void pending.catch(() => {
      window.alert('Você saiu deste aparelho, mas não foi possível confirmar o encerramento no servidor. A sessão continuará sujeita à expiração normal.');
    });
  };

  return { auth, status, retry, handleLogin, handleLogout };
}
