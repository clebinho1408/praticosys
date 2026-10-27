// Run through test:cpf-postgres, never against a configured/shared database.
import assert from 'node:assert/strict';
import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
// @ts-ignore Shared migration used verbatim by the Express startup.
import { CPF_NEON_MIGRATION } from '../../db/cpf-migration.js';

const socket = process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket === tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON, undefined);
assert.equal(process.env.APICPF_API_KEY, undefined);
assert.equal(process.env.DATABASE_URL,
  `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
// Import only after checking the isolated environment (the DB chooses its URL on import).
const { pool } = await import('@workspace/db');
let checks = 0;
const equal = (actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected); checks++; };
const query = (statement: string, values?: unknown[]) => pool.query(statement, values);
const cpf = '12345678909'; // Synthetic checksum fixture; all fetches are intercepted.
const body = { cpf, module: 'CNH_BRASIL' };
let upstreamCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  // No network fallback, including for unexpected destinations.
  const url = new URL(String(input));
  equal(url.origin + url.pathname, 'https://apicpf.com/api/consulta');
  equal(url.searchParams.get('cpf'), cpf);
  equal(new Headers(init?.headers).get('X-API-KEY'), 'synthetic-test-only');
  upstreamCalls++;
  return Response.json({ code: 200, data: {
    nome: ' Pessoa Fictícia ', cpf, genero: 'ignored', data_nascimento: 'ignored',
  }, secret: 'must-not-leak' });
};

let server: Server | undefined;
try {
  // Frozen pre-feature fixture: intentionally lacks the new preference and quota table.
  await query(`
    CREATE TABLE configuracoes (
      id integer PRIMARY KEY DEFAULT 1, nome_orgao text DEFAULT 'DETRAN', endereco_orgao text,
      url_logo text, modo_manutencao boolean DEFAULT false, min_dias_agendamento integer DEFAULT 2,
      max_vagas_diarias integer DEFAULT 50, max_vagas_a_padrao integer DEFAULT 10,
      max_vagas_b_padrao integer DEFAULT 10, max_vagas_mudanca_padrao integer DEFAULT 10,
      template_whatsapp text, template_whatsapp_cfc text, endereco_exame_padrao text,
      link_exame_padrao text, restricoes jsonb DEFAULT '[]', nome_exame_pcd text,
      endereco_exame_pcd_padrao text, link_exame_pcd_padrao text, banca_principal_pcd jsonb,
      banca_principal_cnh_brasil jsonb, bloquear_fins_semana boolean DEFAULT false,
      chave_area_risco text, ano_fabricacao_maximo jsonb
    );
    CREATE TABLE usuarios (id text PRIMARY KEY, perfil text NOT NULL, modulos_permitidos jsonb);
    CREATE TABLE sessoes (id text PRIMARY KEY, usuario_id text REFERENCES usuarios(id), expira_em timestamptz);
    CREATE TABLE dados_preservados (id integer PRIMARY KEY, descricao text);
    INSERT INTO dados_preservados VALUES (1, 'sentinela');
    INSERT INTO configuracoes (id, nome_orgao, endereco_orgao) VALUES (1, 'Órgão fictício', 'Endereço fictício');
  `);
  const columnsBefore = (await query(`SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns WHERE table_name='configuracoes' ORDER BY ordinal_position`)).rows;
  await query(CPF_NEON_MIGRATION);
  await query(CPF_NEON_MIGRATION);
  equal((await query('SELECT preencher_nome_cpf_cnh FROM configuracoes')).rows, [{ preencher_nome_cpf_cnh: false }]);
  const columnsAfter = (await query(`SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns WHERE table_name='configuracoes' ORDER BY ordinal_position`)).rows;
  equal(columnsAfter.slice(0, -1), columnsBefore);
  equal(columnsAfter.at(-1), {
    column_name: 'preencher_nome_cpf_cnh', data_type: 'boolean', column_default: 'false', is_nullable: 'NO',
  });
  equal((await query('SELECT * FROM dados_preservados')).rows, [{ id: 1, descricao: 'sentinela' }]);
  equal((await query('SELECT nome_orgao, endereco_orgao FROM configuracoes')).rows,
    [{ nome_orgao: 'Órgão fictício', endereco_orgao: 'Endereço fictício' }]);
  await query(`INSERT INTO configuracoes (id) VALUES (2)`);
  equal((await query('SELECT preencher_nome_cpf_cnh FROM configuracoes WHERE id=2')).rows[0].preencher_nome_cpf_cnh, false);
  await query('DELETE FROM configuracoes WHERE id=2');
  for (const role of ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'INSTRUCTOR', 'SCHOOL', 'EXAMINER', 'CONSULTANT']) {
    await query(`INSERT INTO usuarios VALUES ($1, $1, '["cnh","cfc"]')`, [role]);
    await query(`INSERT INTO sessoes VALUES ($1, $1, NOW() + interval '1 hour')`, [role]);
  }
  await query(`INSERT INTO sessoes VALUES ('expired', 'ADMIN', NOW() - interval '1 hour')`);
  // The real app includes the real session middleware, route adapter and node-postgres pool.
  // @ts-ignore Cross-artifact source loaded only by this integration worker.
  const { default: app } = await import('../../artifacts/api-server/src/app.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  async function api(route: string, method = 'POST', payload: unknown = body, token?: string, status = 200) {
    const response = await new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: any }>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path: `/api/${route}`, method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      }, res => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { text += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode!, headers: res.headers, body: JSON.parse(text) }); }
          catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.end(method === 'GET' ? undefined : JSON.stringify(payload));
    });
    equal(response.status, status);
    if (route === 'cpf-lookup' && ![401].includes(status)) equal(response.headers['cache-control'], 'no-store');
    if (status >= 400) {
      equal(Object.keys(response.body), ['error']);
      if (route === 'cpf-lookup' && status !== 401) assert.match(response.body.error, /manualmente/);
    }
    return response.body;
  }
  equal((await api('settings', 'GET', undefined, 'ADMIN')).cnhCpfAutofillEnabled, false);
  for (const token of [undefined, 'invalid', 'expired']) await api('cpf-lookup', 'POST', body, token, 401);
  await api('cpf-lookup', 'POST', body, 'ADMIN', 409);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: true }, 'OPERATOR', 403);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: 'true' }, 'ADMIN', 400);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: true }, 'ADMIN');
  await api('cpf-lookup', 'POST', body, 'ADMIN', 503); // Missing secret: no quota or provider call.
  equal(upstreamCalls, 0);
  equal((await query('SELECT * FROM cotas_consulta_cpf')).rows, []);
  process.env.APICPF_API_KEY = 'synthetic-test-only';
  for (const token of ['SCHOOL', 'EXAMINER', 'CONSULTANT']) await api('cpf-lookup', 'POST', body, token, 403);
  for (const module of ['CFC', 'PCD', undefined]) await api('cpf-lookup', 'POST', { cpf, module }, 'ADMIN', 403);
  for (const token of ['OPERATOR', 'SUPERVISOR']) {
    await query(`UPDATE usuarios SET modulos_permitidos='["cfc"]' WHERE id=$1`, [token]);
    await api('cpf-lookup', 'POST', body, token, 403);
    await query(`UPDATE usuarios SET modulos_permitidos='["cnh"]' WHERE id=$1`, [token]);
  }
  await api('cpf-lookup', 'POST', { ...body, cpf: '00000000000' }, 'ADMIN', 400);
  equal(upstreamCalls, 0);
  for (const token of ['ADMIN', 'OPERATOR', 'SUPERVISOR', 'INSTRUCTOR']) {
    equal(await api('cpf-lookup', 'POST', body, token), { name: 'Pessoa Fictícia' });
  }
  // Reapplying the migration must preserve an enabled preference and existing quota.
  await query(CPF_NEON_MIGRATION);
  equal((await api('settings', 'GET', undefined, 'ADMIN')).cnhCpfAutofillEnabled, true);
  equal((await query(`SELECT consultas FROM cotas_consulta_cpf WHERE id='ADMIN'`)).rows[0].consultas, 1);
  await api('settings', 'PUT', { agencyAddress: 'Editado' }, 'OPERATOR');
  equal((await api('settings', 'GET', undefined, 'ADMIN')).cnhCpfAutofillEnabled, true);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: false }, 'ADMIN');
  await api('cpf-lookup', 'POST', body, 'ADMIN', 409);
  equal(upstreamCalls, 4);
  await api('settings', 'PUT', { cnhCpfAutofillEnabled: true }, 'ADMIN');

  // Freeze only the JS quota clock; avoid minute-boundary flakiness in concurrent SQL.
  const realNow = Date.now;
  Date.now = () => 1_800_000_000_000;
  try {
    await query('TRUNCATE cotas_consulta_cpf');
    const before = upstreamCalls;
    // Concurrent HTTP requests use independent PostgreSQL pool connections.
    const statuses = await Promise.all(Array.from({ length: 24 }, async () => {
      const res = await new Promise<number>((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, path: '/api/cpf-lookup', method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ADMIN' },
        }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
        req.on('error', reject); req.end(JSON.stringify(body));
      });
      return res;
    }));
    equal(statuses.filter(s => s === 200).length, 10);
    equal(statuses.filter(s => s === 429).length, 14);
    equal(upstreamCalls - before, 10);
    equal((await query('SELECT * FROM cotas_consulta_cpf')).rows,
      [{ id: 'ADMIN', janela_minuto: 30_000_000, consultas: 10 }]);
    equal(await api('cpf-lookup', 'POST', body, 'OPERATOR'), { name: 'Pessoa Fictícia' });
    await query(`UPDATE cotas_consulta_cpf SET janela_minuto=0 WHERE id='ADMIN'`);
    equal(await api('cpf-lookup', 'POST', body, 'ADMIN'), { name: 'Pessoa Fictícia' });
    equal((await query(`SELECT consultas FROM cotas_consulta_cpf WHERE id='ADMIN'`)).rows[0].consultas, 1);
  } finally { Date.now = realNow; }
  // Quota persistence stores neither CPF nor provider payload; legacy data survives.
  equal((await query(`SELECT column_name FROM information_schema.columns
    WHERE table_name='cotas_consulta_cpf' ORDER BY ordinal_position`)).rows.map(r => r.column_name),
  ['id', 'janela_minuto', 'consultas']);
  process.stdout.write(`CPF Express/PostgreSQL: ${checks} verificações passaram; banco efêmero e APICPF simulada.\n`);
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.APICPF_API_KEY;
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
