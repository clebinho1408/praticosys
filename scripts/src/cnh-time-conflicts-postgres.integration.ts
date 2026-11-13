import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { is, Table } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as schema from '../../db/schema.js';
import { hashPassword } from '../../functions/_password.js';
import { testCnhTimePolicy, testCnhConflictApi } from './cnh-time-conflicts-cases.js';

const socket = process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket === tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON, undefined);
assert.equal(process.env.DATABASE_URL, `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
const { pool, db } = await import('@workspace/db');
let server: import('node:http').Server | undefined;
try {
  for (const table of Object.values(schema).filter((value: any) => is(value, Table))) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`);
    await pool.query(`CREATE TABLE "${config.name}" (${columns.join(', ')})`);
  }
  await pool.query('CREATE TABLE sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamptz NOT NULL, criado_em timestamptz DEFAULT now())');
  await db.insert(schema.users).values({ id: 'synthetic-admin', name: 'Synthetic administrator', login: 'business-test',
    password: await hashPassword('Synthetic-business-2026!'), role: 'ADMIN', forcePasswordChange: false });
  await pool.query("INSERT INTO sessoes VALUES ('synthetic-business-session', 'synthetic-admin', NOW() + interval '10 minutes')");
  const { sessionAuth } = await import('../../artifacts/api-server/src/middleware/session.js');
  const { default: router } = await import('../../artifacts/api-server/src/routes/praticosys.js');
  const express = createRequire(new URL('../../artifacts/api-server/package.json', import.meta.url))('express');
  const app = express();
  app.use(express.json());
  app.use('/api', sessionAuth, router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server!.address() as { port: number };
  testCnhTimePolicy();
  await testCnhConflictApi(async (route, method, body) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/${route}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-business-session' }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  });
  console.log('CNH: mesmos cenários de conflito e preservação verificados no Express/PostgreSQL efêmero.');
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.end();
}
