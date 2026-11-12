import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { users } from '../../db/schema.js';
import { testSessionRestoration } from './session-restoration-cases.js';

const socket = process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket === tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON, undefined);
assert.equal(process.env.DATABASE_URL, `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
const { pool } = await import('@workspace/db');
let server: import('node:http').Server | undefined;
try {
  const config = getTableConfig(users);
  const columns = config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`);
  await pool.query(`CREATE TABLE "${config.name}" (${columns.join(', ')})`);
  await pool.query('CREATE TABLE sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())');
  const { hashPassword } = await import('../../functions/_password.js');
  await pool.query(`INSERT INTO usuarios (id, nome, login, senha, perfil) VALUES ($1, $2, $3, $4, $5)`,
    ['session-fixture', 'Examinador fictício', 'session.examiner', await hashPassword('Fixture-session-2026!'), 'EXAMINER']);
  const { default: router } = await import('../../artifacts/api-server/src/routes/praticosys.js');
  const { sessionAuth } = await import('../../artifacts/api-server/src/middleware/session.js');
  const express = createRequire(new URL('../../artifacts/api-server/package.json', import.meta.url))('express');
  const app = express();
  app.use(express.json());
  app.use('/api', sessionAuth, router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server!.address() as { port: number };
  await testSessionRestoration(async (method, token, body, extraHeaders) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/${method === 'LOGIN' ? 'auth' : 'session'}`, {
      method: method === 'LOGIN' ? 'POST' : method,
      headers: { 'Content-Type': 'application/json', ...extraHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json(), cache: response.headers.get('Cache-Control') };
  }, {
    login: 'session.examiner', password: 'Fixture-session-2026!',
    expiry: async token => {
      const result = await pool.query('SELECT expira_em FROM sessoes WHERE id = $1', [token]);
      return result.rows[0].expira_em.toISOString();
    },
    expire: async token => { await pool.query("UPDATE sessoes SET expira_em = NOW() - interval '1 minute' WHERE id = $1", [token]); },
    changeRole: async () => { await pool.query(`UPDATE usuarios SET perfil = 'SUPERVISOR', modulos_permitidos = '["cfc"]' WHERE id = 'session-fixture'`); },
    deleteUser: async () => { await pool.query("DELETE FROM usuarios WHERE id = 'session-fixture'"); },
    breakDatabase: async () => { await pool.query('DROP TABLE sessoes'); },
  });
  console.log('Sessão: mesmos cenários HTTP e de persistência passaram em Express/PostgreSQL efêmero.');
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.end();
}
