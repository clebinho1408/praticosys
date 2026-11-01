import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { localD1 } from './d1-runtime.js';
import { examModality, modalityValidationError, specialExamLabel, receiptInstructor } from '../../functions/_cnh-exam-modality.js';
import { cnhbrasilRequests } from '../../db/schema.js';
import { initialD1Statements, D1_INITIAL_CHECKSUM, d1Checksum, migrateD1 } from '../../db/d1-schema.js';
import { CNH_MODALITY_VERSION, migrateCnhModalityD1 } from '../../db/cnh-exam-modality-migration.js';
// Pages ambient types belong to workerd; load through the runtime harness boundary.
const { onRequest } = await import(new URL('../../functions/api/requests.ts', import.meta.url).href);

assert.equal(await d1Checksum(), D1_INITIAL_CHECKSUM);
assert.ok(!initialD1Statements().join('\n').includes('modalidade_exame_'));
for (const category of ['A', 'B'] as const) {
  const field = category === 'A' ? 'examModalityA' : 'examModalityB';
  for (const modality of ['STANDARD', 'PCD', 'REABILITACAO'] as const) {
    const data = { intendedCategory: category, instructor: 'Instrutor fictício', [field]: modality };
    assert.equal(examModality(data, category), modality);
    assert.equal(modalityValidationError(data), null);
    assert.equal(receiptInstructor(data), 'Instrutor fictício');
    assert.equal(specialExamLabel(data), modality === 'PCD' ? 'PROVA DE DIREÇÃO PCD'
      : modality === 'REABILITACAO' ? 'PROVA DE REABILITAÇÃO' : null);
  }
}
for (const instructor of ['PROVA DE DIRECAO PCD', 'PROVA DE REABILITACAO']) {
  const legacy = { intendedCategory: 'B', instructor };
  assert.ok(specialExamLabel(legacy));
  assert.equal(receiptInstructor(legacy), '');
  assert.equal(specialExamLabel({ ...legacy, examModalityB: 'STANDARD' }), null);
}
const ab = {
  intendedCategory: 'AB', instructor: 'Moto: Instrutor Moto / Carro: Instrutor Carro',
  examModalityA: 'PCD' as const, examModalityB: 'REABILITACAO' as const,
};
assert.equal(specialExamLabel({ ...ab, scheduledCategory: 'A' }), 'PROVA DE DIREÇÃO PCD');
assert.equal(receiptInstructor({ ...ab, scheduledCategory: 'A' }), 'Instrutor Moto');
assert.equal(specialExamLabel({ ...ab, scheduledCategory: 'B' }), 'PROVA DE REABILITAÇÃO');
assert.equal(receiptInstructor({ ...ab, scheduledCategory: 'B' }), 'Instrutor Carro');
for (const invalid of [true, false, 123, [], {}, 'PCD,REABILITACAO', '']) {
  assert.ok(modalityValidationError({ examModalityA: invalid }));
}

const runtime = await localD1();
try {
  // Exercise the actual Pages handlers with a local-only D1 binding.
  const call = (method: string, body: Record<string, unknown>) => onRequest({
    request: new Request('http://test.invalid/api/requests', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    env: runtime.env, data: { sessionUserRole: 'ADMIN' },
  } as any);
  const input = {
    id: 'synthetic-modality', studentName: 'Candidato fictício', instructor: 'Instrutor fictício',
    intendedCategory: 'A', vehiclePlate: 'ABC1D23', examType: 'COMMON',
    source: 'STUDENT_DIRECT', modulo: 'CNH_BRASIL', status: 'WAITING_SCHEDULING',
    examModalityA: 'PCD',
  };
  const created = await call('POST', input);
  assert.equal(created.status, 200);
  assert.equal((await created.json() as any).examModalityA, 'PCD');
  for (const modality of ['REABILITACAO', 'STANDARD', 'PCD']) {
    const response = await call('PUT', { id: input.id, examModalityA: modality });
    assert.equal(response.status, 200);
    const row = (await response.json()) as any;
    assert.equal(row.examModalityA, modality);
    assert.equal(row.instructor, input.instructor);
    assert.equal(row.vehiclePlate, input.vehiclePlate);
  }
  const bad = await call('PUT', { id: input.id, examModalityA: ['PCD', 'REABILITACAO'] });
  assert.equal(bad.status, 400);
  const rows = await runtime.db.select().from(cnhbrasilRequests).where(eq(cnhbrasilRequests.id, input.id));
  assert.equal(rows[0].examModalityA, 'PCD');
  const listed = await onRequest({
    request: new Request('http://test.invalid/api/requests'), env: runtime.env, data: {},
  } as any);
  assert.equal((await listed.json() as any[]).find(row => row.id === input.id).examModalityA, 'PCD');
  await migrateD1(runtime.binding as any);
  assert.equal((await runtime.db.select().from(cnhbrasilRequests))[0].instructor, input.instructor);
  await assert.rejects(() => runtime.binding.prepare(
    "UPDATE solicitacoes_cnhbrasil SET modalidade_exame_a = 'PCD,REABILITACAO'").run());
  // Both columns + marker must roll back together on an upgrade failure.
  const old = await localD1(false, false);
  try {
    const b = old.binding;
    await b.batch(initialD1Statements().map(statement => b.prepare(statement)));
    await b.prepare(`INSERT INTO solicitacoes_cnhbrasil (id, tipo_exame, origem, status, instrutor)
      VALUES ('legacy', 'COMMON', 'STUDENT_DIRECT', 'WAITING_SCHEDULING', 'PROVA DE DIRECAO PCD')`).run();
    await b.prepare(`CREATE TRIGGER reject_modality_marker BEFORE INSERT ON migracoes_d1
      WHEN NEW.versao = '${CNH_MODALITY_VERSION}' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END`).run();
    await assert.rejects(() => migrateCnhModalityD1(b as any));
    assert.ok(!(await b.prepare('PRAGMA table_info(solicitacoes_cnhbrasil)').all()).results
      .some(column => column.name === 'modalidade_exame_a'));
    await b.prepare('DROP TRIGGER reject_modality_marker').run();
    await migrateCnhModalityD1(b as any);
    await migrateCnhModalityD1(b as any);
    const legacy = await b.prepare("SELECT * FROM solicitacoes_cnhbrasil WHERE id='legacy'").first<any>();
    assert.equal(legacy.instrutor, 'PROVA DE DIRECAO PCD');
    assert.equal(legacy.modalidade_exame_a, null);
  } finally { await old.mf.dispose(); }
  console.log('Modalidades CNH: contrato, modelos, instrutores, API Pages, persistência e migração D1 verificados com dados fictícios.');
} finally { await runtime.mf.dispose(); }
