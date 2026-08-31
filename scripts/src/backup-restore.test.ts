import assert from 'node:assert/strict';
import { PgDialect } from 'drizzle-orm/pg-core';
// @ts-ignore The test intentionally exercises the shared compatibility source.
import { normalizeBackupPayload, restoreBackup } from '../../functions/_backup-restore.js';

const requiredVehicleFields = {
  id: 'vehicle-compat-test',
  instructor_id: 'instructor-compat-test',
  type: 'CAR',
  brand: 'Marca',
  model: 'Modelo',
  plate: 'TEST0001',
  active: true,
  duplo_comando: true,
  procuracao: true,
};

const legacyPayload = { vehicles: [requiredVehicleFields] };
const currentPayload = { veiculos: [requiredVehicleFields] };

for (const [payload, expectedFormat] of [
  [legacyPayload, 'english'],
  [currentPayload, 'portuguese'],
] as const) {
  const normalized = normalizeBackupPayload(payload);
  assert.equal(normalized.veiculos[0].duplo_comando, true);
  assert.equal(normalized.veiculos[0].procuracao, true);

  const executedQueries: unknown[] = [];
  const transaction = {
    execute: async (query: unknown) => {
      executedQueries.push(query);
      return [];
    },
  };
  const db = {
    transaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) => callback(transaction),
  };
  const result = await restoreBackup(db, payload);

  assert.equal(result.format, expectedFormat);
  assert.deepEqual(result.restored, { veiculos: 1 });
  assert.equal(executedQueries.length, 1);

  const compiledQuery = new PgDialect().sqlToQuery(executedQueries[0] as any);
  assert.match(compiledQuery.sql, /duplo_comando/);
  assert.match(compiledQuery.sql, /procuracao/);
  assert.equal(compiledQuery.params.filter((value) => value === true).length >= 2, true);
}

console.log('backup restore vehicle compatibility tests passed');