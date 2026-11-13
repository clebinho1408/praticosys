import { localD1, pagesHarness } from './d1-runtime.js';
import { securityFixture, verifySecurity } from './security-regression-cases.js';
const runtime = await localD1();
try {
  const tokens = await securityFixture(runtime.db);
  const harness = await pagesHarness(runtime.env);
  try {
    const count = await verifySecurity(async (role, method, route, body) => {
      const token = role?.startsWith('SESSION:') ? role.slice(8) : role ? tokens.get(role) ?? 'invalid-token' : null;
      const response = await harness.dispatch(new Request(`https://isolated.invalid/api/${route}`, {
        method, headers: { 'Content-Type': 'application/json', 'X-User-Id': 'forged-admin',
          'X-User-Role': 'ADMIN', 'CF-Connecting-IP': '192.0.2.1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }));
      return { status: response.status, body: await response.json() };
    }, runtime.db);
    console.log(`Pages/D1: ${count} security assertions passed on synthetic ephemeral data.`);
  } finally { await harness.drain(); }
} finally { await runtime.mf.dispose(); }
