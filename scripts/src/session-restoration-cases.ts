import assert from 'node:assert/strict';

type SessionResponse = { status: number; body: any; cache: string | null };

/** Identical HTTP and persistence checks for real Pages/D1 and Express/Postgres handlers. */
export async function testSessionRestoration(
  call: (method: string, token?: string, body?: unknown, headers?: Record<string, string>) => Promise<SessionResponse>,
  fixture: {
    login: string;
    password: string;
    expiry: (token: string) => Promise<string>;
    expire: (token: string) => Promise<void>;
    changeRole: () => Promise<void>;
    deleteUser: () => Promise<void>;
    breakDatabase: () => Promise<void>;
  },
) {
  assert.equal((await call('GET')).status, 401);
  assert.equal((await call('GET', undefined, undefined, { 'X-User-Id': 'fixture', 'X-User-Role': 'ADMIN' })).status, 401);
  assert.equal((await call('GET', 'missing-session')).status, 401);
  const login = await call('LOGIN', undefined, { login: fixture.login, password: fixture.password });
  assert.equal(login.status, 200);
  const token = login.body.sessionToken as string;
  assert.ok(token);
  const expiresBefore = await fixture.expiry(token);
  const remaining = Date.parse(expiresBefore) - Date.now();
  assert.ok(remaining > 7.9 * 60 * 60 * 1000 && remaining <= 8 * 60 * 60 * 1000);
  const restored = await call('GET', token);
  assert.equal(restored.status, 200);
  assert.equal(restored.cache, 'no-store');
  assert.equal(restored.body.role, 'EXAMINER');
  assert.equal(restored.body.login, fixture.login);
  assert.equal(restored.body.password, undefined);
  assert.equal(restored.body.sessionToken, undefined);
  assert.equal(await fixture.expiry(token), expiresBefore, 'restoration must not extend expiry');

  await fixture.changeRole();
  const updated = await call('GET', token);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.role, 'SUPERVISOR', 'identity comes from the current database row');
  assert.deepEqual(updated.body.allowedModules, ['cfc']);

  const secondLogin = await call('LOGIN', undefined, { login: fixture.login, password: fixture.password });
  const secondToken = secondLogin.body.sessionToken as string;
  assert.equal((await call('DELETE', token)).status, 200);
  assert.equal((await call('GET', token)).status, 401);
  assert.equal((await call('GET', secondToken)).status, 200, 'logout revokes only the intended session');
  await fixture.expire(secondToken);
  assert.equal((await call('GET', secondToken)).status, 401);
  const thirdLogin = await call('LOGIN', undefined, { login: fixture.login, password: fixture.password });
  await fixture.deleteUser();
  assert.equal((await call('GET', thirdLogin.body.sessionToken)).status, 401);
  await fixture.breakDatabase();
  const unavailable = await call('GET', 'synthetic-token');
  assert.equal(unavailable.status, 503, 'database outage is not a session rejection');
  assert.equal(unavailable.cache, 'no-store');
  assert.equal((await call('DELETE', 'synthetic-token')).status, 503);
}
