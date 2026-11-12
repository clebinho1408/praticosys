import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { localD1, seedD1, pagesHarness, DEMO_PASSWORD } from './d1-runtime.js';
// @ts-ignore Exercise the actual Pages schema in an ephemeral synthetic database.
import { cfcRequests } from '../../db/schema.js';

const runtime = await localD1();
try {
  await seedD1(runtime.db);
  const harness = await pagesHarness(runtime.env);
  try {
    const call = async (path: string, method: string, body?: unknown, token?: string) => {
      const response = await harness.dispatch(new Request(`http://test.invalid/api/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }));
      return { status: response.status, body: await response.json() as any };
    };
    const login = await call('auth', 'POST', { login: 'd1.examiner', password: DEMO_PASSWORD });
    assert.equal(login.status, 200);
    const token = login.body.sessionToken;
    assert.equal(typeof token, 'string');
    const id = 'd1-candidate-CFC';
    const other = { examinerId: 'other', name: 'Other synthetic examiner', registeredAt: new Date().toISOString() };
    await runtime.db.update(cfcRequests).set({ interestedExaminers: [other] }).where(eq(cfcRequests.id, id));
    const added = await call('requests', 'PUT', { id, registerInterest: true }, token);
    assert.equal(added.status, 200);
    assert.equal(added.body.interestedExaminers.length, 2);
    const removed = await call('requests', 'PUT', { id, removeInterest: true, examinerId: 'other', status: 'CANCELLED' }, token);
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.interestedExaminers, [other]);
    assert.equal(removed.body.status, 'WAITING_SCHEDULING');
    assert.equal(removed.body.examinerId, null);
    const reloaded = await call('requests', 'GET', undefined, token);
    assert.deepEqual(reloaded.body.find((r: any) => r.id === id).interestedExaminers, [other]);
    assert.equal((await call('requests', 'PUT', { id, registerInterest: true }, token)).status, 200);
    assert.equal((await call('requests', 'PUT', { id, removeInterest: 'true' }, token)).status, 400);
    assert.equal((await call('requests', 'PUT', { id, removeInterest: true, registerInterest: true }, token)).status, 400);
    const admin = await call('auth', 'POST', { login: 'd1.admin', password: DEMO_PASSWORD });
    assert.equal((await call('requests', 'PUT', { id, removeInterest: true }, admin.body.sessionToken)).status, 403);
    await runtime.db.update(cfcRequests).set({ status: 'SCHEDULED' }).where(eq(cfcRequests.id, id));
    assert.equal((await call('requests', 'PUT', { id, removeInterest: true }, token)).status, 409);
    console.log('PASS: Pages/D1 interest withdrawal, session identity, other interests, reload, re-registration and stale/invalid actions.');
  } finally { await harness.drain(); }
} finally { await runtime.mf.dispose(); }
