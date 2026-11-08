import { localD1 } from './d1-runtime.js';
import { testCnhTimePolicy, testCnhConflictApi } from './cnh-time-conflicts-cases.js';

testCnhTimePolicy();
const handlers: Record<string, any> = {
  schools: (await import(new URL('../../functions/api/schools.ts', import.meta.url).href)).onRequest,
  schedules: (await import(new URL('../../functions/api/schedules.ts', import.meta.url).href)).onRequest,
};
const runtime = await localD1();
try {
  await testCnhConflictApi(async (route, method, body) => {
    const response = await handlers[route]({
      request: new Request(`http://test.invalid/api/${route}`, {
        method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      }), env: runtime.env, data: { sessionUserRole: 'ADMIN' },
    });
    return { status: response.status, body: await response.json() };
  });
  console.log('CNH: conflitos de bancas e escalas, criação/edição, perfil, persistência e preservação verificados em Pages/D1 fictício.');
} finally { await runtime.mf.dispose(); }
