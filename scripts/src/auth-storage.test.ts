import assert from 'node:assert/strict';
import { test, after } from 'node:test';
// @ts-ignore Frontend service regression tests intentionally run outside scripts rootDir.
import { parseSavedAuth, authenticatedState, AUTH_STORAGE_KEY, EMPTY_AUTH } from '../../artifacts/praticosys/src/services/authStorage';
// Runtime import keeps the browser-only service out of the Node-only TS project.
const { api } = await import(new URL('../../artifacts/praticosys/src/services/api.ts', import.meta.url).href);
// @ts-ignore Frontend types.
import { UserRole } from '../../artifacts/praticosys/src/types';

const user = { id: 'synthetic', name: 'Examinador de teste', login: 'test.examiner', role: UserRole.EXAMINER };
const saved = authenticatedState(user, 'synthetic-token');
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};
const browser = Object.assign(new EventTarget(), { location: { hash: '' } });
const originalFetch = globalThis.fetch;
const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
after(() => {
  globalThis.fetch = originalFetch;
  if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
const reset = () => { storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(saved)); browser.location.hash = '#/'; };

test('restores complete saved auth, rejects corrupt/tokenless data, never persists a password', () => {
  assert.deepEqual(parseSavedAuth(JSON.stringify(saved)), saved);
  for (const raw of [null, 'broken', 'null', '{}', JSON.stringify({ ...saved, token: null }),
    JSON.stringify({ ...saved, isAuthenticated: false }), JSON.stringify({ ...saved, user: { ...user, role: 'OTHER' } })]) {
    assert.deepEqual(parseSavedAuth(raw), EMPTY_AUTH);
  }
  assert.equal(authenticatedState({ ...user, password: 'do-not-save' }, 'synthetic').user?.password, undefined);
  assert.throws(() => authenticatedState(user, ''), /sessão válida/);
});

test('session restore uses the saved bearer and bypasses HTTP caches', async () => {
  reset();
  globalThis.fetch = (async (input: any, init: RequestInit) => {
    assert.equal(input, '/api/session');
    assert.equal((init.headers as any).Authorization, 'Bearer synthetic-token');
    assert.equal(init.cache, 'no-store');
    return Response.json(user);
  }) as typeof fetch;
  assert.deepEqual(await api.getSession(), user);
  assert.ok(storage.getItem(AUTH_STORAGE_KEY));
});

test('network and service failures preserve the saved login', async () => {
  for (const unavailable of ['network', 503]) {
    reset();
    globalThis.fetch = (async () => {
      if (unavailable === 'network') throw new TypeError('Failed to fetch');
      return Response.json({ error: 'Indisponível' }, { status: 503 });
    }) as typeof fetch;
    await assert.rejects(api.getSession());
    assert.ok(storage.getItem(AUTH_STORAGE_KEY));
    assert.equal(browser.location.hash, '#/');
  }
});

test('only a 401 for the current bearer clears persisted authentication', async () => {
  reset();
  globalThis.fetch = (async () => Response.json({ error: 'expired' }, { status: 401 })) as typeof fetch;
  await assert.rejects(api.getSession(), (error: any) => error.status === 401);
  assert.equal(storage.getItem(AUTH_STORAGE_KEY), null);
  assert.equal(browser.location.hash, '#/login');

  reset();
  globalThis.fetch = (async () => {
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedState(user, 'new-session')));
    return Response.json({ error: 'expired old request' }, { status: 401 });
  }) as typeof fetch;
  await assert.rejects(api.getSession());
  assert.equal(parseSavedAuth(storage.getItem(AUTH_STORAGE_KEY)).token, 'new-session');
  assert.equal(browser.location.hash, '#/');
});

test('bad credentials do not invalidate an already active session', async () => {
  reset();
  globalThis.fetch = (async () => Response.json({ error: 'bad credentials' }, { status: 401 })) as typeof fetch;
  await assert.rejects(api.login('wrong', 'wrong'));
  assert.ok(storage.getItem(AUTH_STORAGE_KEY));
});

test('logout captures the bearer before local removal and revokes with keepalive', async () => {
  reset();
  globalThis.fetch = (async (_input: any, init: RequestInit) => {
    assert.equal(init.method, 'DELETE');
    assert.equal(init.keepalive, true);
    assert.equal((init.headers as any).Authorization, 'Bearer synthetic-token');
    return Response.json({ success: true });
  }) as typeof fetch;
  const pending = api.logout();
  storage.removeItem(AUTH_STORAGE_KEY);
  await pending;
  assert.equal(storage.getItem(AUTH_STORAGE_KEY), null);
});
