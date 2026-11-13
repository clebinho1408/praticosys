import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { isTable } from 'drizzle-orm';
import * as schema from '../../db/schema.js';
import { securityFixture, verifySecurity } from './security-regression-cases.js';
const socket = process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket === tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON, undefined);
assert.equal(process.env.DATABASE_URL, `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
const { pool, db } = await import('@workspace/db');
let server: import('node:http').Server | undefined;
try {
  const created = new Set<string>();
  for (const table of Object.values(schema)) {
    if (!isTable(table)) continue;
    const config = getTableConfig(table as any);
    if (created.has(config.name)) continue;
    created.add(config.name);
    const cols = config.columns.map(c => `"${c.name}" ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}`);
    await pool.query(`CREATE TABLE "${config.name}" (${cols.join(',')})`);
  }
  await pool.query('CREATE TABLE sessoes(id text PRIMARY KEY,usuario_id text,expira_em timestamp,criado_em timestamp DEFAULT now())');
  await pool.query('CREATE TABLE backups(id text PRIMARY KEY,tipo_gatilho text,dados jsonb,tamanho_bytes integer,criado_em timestamp DEFAULT now())');
  const tokens = await securityFixture(db);
  const express = createRequire(new URL('../../artifacts/api-server/package.json', import.meta.url))('express');
  const { default: router } = await import('../../artifacts/api-server/src/routes/praticosys.js');
  const { sessionAuth } = await import('../../artifacts/api-server/src/middleware/session.js');
  const app = express(); app.use(express.json()); app.use('/api', sessionAuth, router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const { port } = server!.address() as { port: number };
  const count = await verifySecurity(async (role, method, route, body) => {
    const token = role?.startsWith('SESSION:') ? role.slice(8) : role ? tokens.get(role) ?? 'invalid-token' : null;
    const response = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-User-Id': 'forged-admin', 'X-User-Role': 'ADMIN',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, db);
  // Express's router is case-insensitive; its security boundary must be too.
  const variant = await fetch(`http://127.0.0.1:${port}/api/SeTTings`, {
    headers: { Authorization: `Bearer ${tokens.get('CONSULTANT')}` },
  });
  assert.equal(variant.status, 200);
  assert.equal((await variant.json() as any).riskAreaKey, undefined);
  console.log(`Express/PostgreSQL: ${count} security assertions passed on synthetic ephemeral data.`);
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.end();
}
