import { UserRole, type AuthState, type User } from '../types';

export const AUTH_STORAGE_KEY = 'praticosys_auth';
export const EMPTY_AUTH: AuthState = { user: null, token: null, isAuthenticated: false };

/** Local identity is only a hint until GET /session validates it on the server. */
export function parseSavedAuth(raw: string | null): AuthState {
  if (!raw) return EMPTY_AUTH;
  try {
    const value = JSON.parse(raw);
    if (value?.isAuthenticated !== true ||
        typeof value.token !== 'string' || !value.token.trim() ||
        typeof value.user?.id !== 'string' || !value.user.id ||
        typeof value.user?.name !== 'string' || typeof value.user?.login !== 'string' ||
        !Object.values(UserRole).includes(value.user?.role)) return EMPTY_AUTH;
    return { user: value.user, token: value.token, isAuthenticated: true };
  } catch {
    return EMPTY_AUTH;
  }
}

export function authenticatedState(user: User, token: string): AuthState {
  if (!token.trim()) throw new Error('O servidor não retornou uma sessão válida. Faça login novamente.');
  const { password: _password, ...safe } = user;
  return { user: safe, token, isAuthenticated: true };
}
