import { sql } from 'drizzle-orm';
import { localD1, seedD1, pagesHarness, DEMO_PASSWORD } from './d1-runtime.js';
import { testSessionRestoration } from './session-restoration-cases.js';

const runtime = await localD1();
try {
  await seedD1(runtime.db);
  const harness = await pagesHarness(runtime.env);
  try {
    await testSessionRestoration(async (method, token, body, extraHeaders) => {
      const response = await harness.dispatch(new Request(
        `http://test.invalid/api/${method === 'LOGIN' ? 'auth' : 'session'}`, {
          method: method === 'LOGIN' ? 'POST' : method,
          headers: {
            'Content-Type': 'application/json', ...extraHeaders,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      ));
      return { status: response.status, body: await response.json(), cache: response.headers.get('Cache-Control') };
    }, {
      login: 'd1.examiner', password: DEMO_PASSWORD,
      expiry: async token => {
        const result = await runtime.db.execute(sql`SELECT expira_em FROM sessoes WHERE id = ${token}`);
        return String((result.rows ?? result)[0].expira_em);
      },
      expire: async token => {
        await runtime.db.execute(sql`UPDATE sessoes SET expira_em = ${new Date(Date.now() - 60_000).toISOString()} WHERE id = ${token}`);
      },
      changeRole: async () => {
        await runtime.db.execute(sql`UPDATE usuarios SET perfil = 'SUPERVISOR', modulos_permitidos = '["cfc"]' WHERE id = 'd1-examiner'`);
      },
      deleteUser: async () => { await runtime.db.execute(sql`DELETE FROM usuarios WHERE id = 'd1-examiner'`); },
      breakDatabase: async () => { await runtime.db.execute(sql`DROP TABLE sessoes`); },
    });
  } finally { await harness.drain(); }
  console.log('Sessão: restauração, identidade atual, expiração de oito horas, revogação e indisponibilidade verificadas em Pages/D1 efêmero.');
} finally { await runtime.mf.dispose(); }
