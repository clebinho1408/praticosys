import { localD1, pagesHarness } from './d1-runtime.js';
import { users } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../../functions/_password.js';
import { testCnhTimePolicy, testCnhConflictApi } from './cnh-time-conflicts-cases.js';

testCnhTimePolicy();
const runtime = await localD1();
const harness = await pagesHarness(runtime.env);
try {
  await runtime.db.insert(users).values({ id: 'synthetic-admin', name: 'Synthetic administrator', login: 'business-test',
    password: await hashPassword('Synthetic-business-2026!'), role: 'ADMIN', forcePasswordChange: false });
  await runtime.db.execute(sql`INSERT INTO sessoes (id, usuario_id, expira_em)
    VALUES ('synthetic-business-session', 'synthetic-admin', ${new Date(Date.now() + 600_000).toISOString()})`);
  await testCnhConflictApi(async (route, method, body) => {
    const response = await harness.dispatch(new Request(`http://test.invalid/api/${route}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-business-session' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    return { status: response.status, body: await response.json() };
  });
  console.log('CNH: conflitos de bancas e escalas, criação/edição, perfil, persistência e preservação verificados em Pages/D1 fictício.');
} finally { await harness.drain(); await runtime.mf.dispose(); }
