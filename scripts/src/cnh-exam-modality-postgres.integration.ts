import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CNH_MODALITY_NEON_SQL } from '../../db/cnh-exam-modality-migration.js';
import { cnhbrasilRequests, cfcRequests, pcdRequests } from '../../db/schema.js';

const socket = process.env.CPF_TEST_SOCKET;
assert.ok(socket && socket === tmpdir() && path.basename(socket).startsWith('cpf-pg-'));
assert.equal(process.env.DATA_BASE_NEON, undefined);
assert.equal(process.env.APICPF_API_KEY, undefined);
assert.equal(process.env.DATABASE_URL,
  `postgresql://postgres@localhost/cpf_test?host=${encodeURIComponent(socket)}`);
// Never import the pool before checking its isolated destination.
const { pool } = await import('@workspace/db');
let server: import('node:http').Server | undefined;
try {
  // Pre-feature database, with every legacy column the real ORM reads.
  for (const table of [cnhbrasilRequests, cfcRequests, pcdRequests]) {
    const config = getTableConfig(table);
    const definitions = config.columns.filter(column => !column.name.startsWith('modalidade_exame_'))
      .map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`);
    await pool.query(`CREATE TABLE "${config.name}" (${definitions.join(', ')})`);
  }
  await pool.query(`INSERT INTO solicitacoes_cnhbrasil
    (id, nome_candidato, instrutor, tipo_exame, origem, status, modulo)
    VALUES ('legacy', 'Pessoa fictícia', 'PROVA DE REABILITACAO', 'COMMON', 'STUDENT_DIRECT', 'WAITING_SCHEDULING', 'CNH_BRASIL')`);
  await pool.query(CNH_MODALITY_NEON_SQL);
  await pool.query(CNH_MODALITY_NEON_SQL);
  const legacy = (await pool.query("SELECT * FROM solicitacoes_cnhbrasil WHERE id='legacy'")).rows[0];
  assert.equal(legacy.instrutor, 'PROVA DE REABILITACAO');
  assert.equal(legacy.modalidade_exame_b, null);

  // Real Express handlers; session identity is injected without authentication changes.
  const { default: router } = await import('../../artifacts/api-server/src/routes/praticosys.js');
  const express = createRequire(new URL('../../artifacts/api-server/package.json', import.meta.url))('express');
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: () => void) => { req.sessionUser = { id: 'synthetic-admin', role: 'ADMIN' }; next(); });
  app.use('/api', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server!.address() as { port: number };
  const api = async (method: string, body?: object) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/requests`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() as any };
  };
  const created = await api('POST', {
    id: 'synthetic-cnh', studentName: 'Pessoa fictícia', instructor: 'Instrutor fictício',
    vehiclePlate: 'ABC1D23', intendedCategory: 'B', source: 'STUDENT_DIRECT',
    examType: 'COMMON', modulo: 'CNH_BRASIL', status: 'WAITING_SCHEDULING',
    examModalityB: 'PCD',
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.examModalityB, 'PCD');
  for (const modality of ['REABILITACAO', 'STANDARD', 'PCD']) {
    const updated = await api('PUT', { id: 'synthetic-cnh', examModalityB: modality });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.examModalityB, modality);
    assert.equal(updated.body.instructor, 'Instrutor fictício');
    assert.equal(updated.body.vehiclePlate, 'ABC1D23');
  }
  const bad = await api('PUT', { id: 'synthetic-cnh', examModalityB: ['PCD', 'REABILITACAO'] });
  assert.equal(bad.status, 400);
  const listed = await api('GET');
  assert.equal(listed.body.find((row: any) => row.id === 'synthetic-cnh').examModalityB, 'PCD');
  await assert.rejects(() => pool.query("UPDATE solicitacoes_cnhbrasil SET modalidade_exame_b='BOTH' WHERE id='synthetic-cnh'"));
  console.log('Modalidades CNH: migração PostgreSQL idempotente, legado preservado, CRUD Express e validação verificados em banco efêmero.');
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await pool.end();
}
