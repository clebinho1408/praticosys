import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { drivingSchools, examSchedules } from '../../db/schema.js';
import { testCnhTimePolicy, testCnhConflictApi } from './cnh-time-conflicts-cases.js';

const socket = process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket === tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON, undefined);
assert.equal(process.env.DATABASE_URL, `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
const { pool } = await import('@workspace/db');
let server: import('node:http').Server | undefined;
try {
  for (const table of [drivingSchools, examSchedules]) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`);
    await pool.query(`CREATE TABLE "${config.name}" (${columns.join(', ')})`);
  }
  const { default: router } = await import('../../artifacts/api-server/src/routes/praticosys.js');
  const express = createRequire(new URL('../../artifacts/api-server/package.json', import.meta.url))('express');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: () => void) => { req.sessionUser = { id: 'synthetic-admin', role: 'ADMIN' }; next(); });
  app.use('/api', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server!.address() as { port: number };
  testCnhTimePolicy();
  await testCnhConflictApi(async (route, method, body) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/${route}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  });
  console.log('CNH: mesmos cenários de conflito e preservação verificados no Express/PostgreSQL efêmero.');
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.end();
}
