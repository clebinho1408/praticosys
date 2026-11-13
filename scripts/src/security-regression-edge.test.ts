import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { root } from './d1-runtime.js';
import { securityFixture, verifySecurity } from './security-regression-cases.js';
import { migrateD1 } from '../../db/d1-schema.js';
import { getDb } from '../../functions/_db.js';
// Same compatibility settings as wrangler.toml; no outbound providers.
const date = '2024-09-23';
const flags = ['nodejs_compat', 'cache_option_enabled'];
execFileSync('pnpm', ['exec', 'wrangler', 'pages', 'functions', 'build',
  '--outdir', 'generated-artifacts/security-worker', '--compatibility-date', date,
  '--compatibility-flags', ...flags], { cwd: root, stdio: 'inherit' });
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, modulesRoot: root,
  scriptPath: path.join(root, 'generated-artifacts/security-worker/index.js'),
  compatibilityDate: date, compatibilityFlags: flags,
  d1Databases: { DB: 'security-ephemeral-only' }, bindings: { DB_PROVIDER: 'd1' },
  serviceBindings: { ASSETS: () => new Response('Not an API', { status: 404 }) },
  outboundService: () => { throw new Error('External services forbidden in isolated security tests'); },
}));
try {
  const binding = await mf.getD1Database('DB');
  await migrateD1(binding as any);
  const db = getDb({ DB_PROVIDER: 'd1', DB: binding });
  const tokens = await securityFixture(db);
  const count = await verifySecurity(async (role, method, route, body) => {
    const token = role?.startsWith('SESSION:') ? role.slice(8) : role ? tokens.get(role) ?? 'invalid-token' : null;
    const response = await mf.dispatchFetch(`https://isolated.invalid/api/${route}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-User-Id': 'forged-admin',
        'X-User-Role': 'ADMIN', 'CF-Connecting-IP': '192.0.2.1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, db);
  console.log(`Compiled Pages Worker: ${count} security assertions passed with production compatibility flags; outbound forbidden.`);
} finally { await mf.dispose(); }
