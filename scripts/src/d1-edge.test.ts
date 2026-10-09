import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { root, seedD1, DEMO_PASSWORD } from './d1-runtime.js';
// @ts-ignore Shared sources.
import { migrateD1 } from '../../db/d1-schema.js';
// @ts-ignore Shared sources.
import { getDb } from '../../functions/_db.js';

execFileSync('pnpm', ['exec', 'wrangler', 'pages', 'functions', 'build', '--outdir',
  'generated-artifacts/d1-worker', '--compatibility-date', '2026-10-01',
  '--compatibility-flags', 'nodejs_compat'], { cwd: root, stdio: 'inherit' });
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, modulesRoot: root, scriptPath: path.join(root, 'generated-artifacts/d1-worker/index.js'),
  compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'],
  d1Databases: { DB: 'isolated-d1-edge-test' }, d1Persist: false,
  bindings: { DB_PROVIDER: 'd1' },
  serviceBindings: { ASSETS: () => new Response('No static assets in API test', { status: 404 }) },
}));
try {
  const binding = await mf.getD1Database('DB');
  await migrateD1(binding as any);
  await seedD1(getDb({ DB_PROVIDER: 'd1', DB: binding }));
  const auth = await mf.dispatchFetch('http://edge-test/api/auth', {
    method: 'POST', body: JSON.stringify({ login: 'd1.admin', password: DEMO_PASSWORD }),
  });
  assert.equal(auth.status, 200);
  const user = await auth.json() as any;
  assert.ok(user.sessionToken && !user.password);
  const headers = { Authorization: `Bearer ${user.sessionToken}`, 'Content-Type': 'application/json' };
  for (const route of ['users', 'requests', 'schedule-slots', 'schedules', 'settings', 'examiners', 'backups']) {
    const response = await mf.dispatchFetch(`http://edge-test/api/${route}`, { headers });
    assert.equal(response.status, 200, route);
    const data = await response.json();
    assert.ok(data);
  }
  const created = await mf.dispatchFetch('http://edge-test/api/backups', { method: 'POST', headers, body: JSON.stringify({ action: 'create' }) });
  assert.equal(created.status, 200);
  const unauthorized = await mf.dispatchFetch('http://edge-test/api/users');
  assert.equal(unauthorized.status, 401);
  process.stdout.write('D1 edge: login, contracts, permissions and manual backup passed in the compiled Pages Worker; no remote service or Neon connection.\n');
} finally { await mf.dispose(); }
