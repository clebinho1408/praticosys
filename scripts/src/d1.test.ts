import assert from 'node:assert/strict';
import { localD1, seedD1, pagesHarness, DEMO_PASSWORD } from './d1-runtime.js';
// @ts-ignore Shared Pages implementation.
import { getDb } from '../../functions/_db.js';
// @ts-ignore Shared schema.
import * as schema from '../../db/schema.js';
// @ts-ignore Shared maintenance implementation.
import { migrateD1 } from '../../db/d1-schema.js';
// @ts-ignore Shared SQL dialect.
import { translateD1Sql } from '../../functions/_d1-sql.js';
// @ts-ignore Shared backup implementation.
import { createD1Backup, readD1Backup, splitD1Text, d1ImportStatements } from '../../functions/_d1-backup.js';
// @ts-ignore Shared restore implementation.
import { restoreBackup } from '../../functions/_backup-restore.js';
import { eq, sql } from 'drizzle-orm';

const runtime = await localD1();
let checks = 0;
const check = (value: unknown) => { assert.ok(value); checks++; };
try {
  assert.throws(() => getDb({ DB_PROVIDER: 'd1', DATABASE_URL: 'must-not-be-used' }), /sem binding/); checks++;
  assert.throws(() => getDb({ DB_PROVIDER: 'invalid' }), /inválido/); checks++;
  assert.deepEqual(translateD1Sql("SELECT '$1 ::jsonb now()', $1::jsonb", ['[]']).params, ['[]']); checks++;
  check(translateD1Sql("SELECT '$1 ::jsonb now()', $1::jsonb", ['[]']).sql.includes("'$1 ::jsonb now()'"));
  await migrateD1(runtime.binding as any); // repeated migration does not modify data
  await seedD1(runtime.db);
  const initial = await runtime.db.select().from(schema.users);
  check(initial.length === 6 && initial.every(u => u.createdAt instanceof Date && Number.isFinite(u.createdAt.getTime())));
  check(initial.every(u => u.forcePasswordChange === false && Array.isArray(u.allowedModules)));

  const harness = await pagesHarness(runtime.env);
  async function api(route: string, method = 'GET', body?: unknown, token?: string, expected = 200) {
    const response = await harness.dispatch(new Request(`http://test/api/${route}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }));
    const data = response.status === 204 ? null : await response.json() as any;
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
    checks++;
    return data;
  }
  await api('users', 'GET', undefined, undefined, 401);
  await api('auth', 'POST', { login: 'd1.admin', password: 'wrong' }, undefined, 401);
  const sessions: Record<string, string> = {};
  for (const role of ['admin', 'supervisor', 'operator', 'school', 'instructor', 'examiner']) {
    const user = await api('auth', 'POST', { login: `d1.${role}`, password: DEMO_PASSWORD });
    check(user.sessionToken && !('password' in user));
    sessions[role] = user.sessionToken;
  }
  await harness.drain();
  const admin = sessions.admin;
  await api('users', 'GET', undefined, sessions.school, 403);
  await api('backups', 'GET', undefined, sessions.supervisor, 403);
  const modules = await api('requests', 'GET', undefined, admin);
  check(modules.length === 3 && new Set(modules.map((x: any) => x.modulo)).size === 3);
  for (const route of ['users', 'schools', 'examiners', 'instructors', 'cities', 'exam-locations',
    'schedules', 'schedule-slots', 'banca-results', 'blocked-dates', 'settings', 'cnh-logs', 'backups']) {
    await api(route, 'GET', undefined, admin);
  }
  const city = await api('cities', 'POST', { name: 'Outra cidade fictícia' }, admin, 201);
  await api('cities', 'PUT', { id: city.id, name: 'Cidade editada' }, admin);
  await api(`cities?id=${city.id}`, 'DELETE', undefined, admin, 204);
  await api('examiners', 'PUT', { id: 'd1-examiner', rotationAvailability: {
    days: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'], defaultTime: '08:00', examsPerDay: 1, cityIds: ['d1-city'],
  } }, admin);
  const extra = await api('requests', 'POST', {
    id: 'extra-test', modulo: 'CFC', schoolId: 'd1-school', examType: 'COMMON',
    source: 'SCHOOL', requestType: 'EXTRA', status: 'WAITING_SCHEDULING',
  }, admin);
  await api('requests', 'PUT', { id: extra.id, extraEdit: true, requestType: 'EXTRA',
    examGroup: '1HAB', intendedCategory: 'A,B', categoryQuantities: { A: 2, B: 3 }, observation: 'Teste' }, admin);
  await api('requests', 'PUT', { id: extra.id, examType: 'PCD' }, admin);
  check((await api('requests', 'GET', undefined, admin)).find((r: any) => r.id === extra.id).modulo === 'PCD');
  await api(`requests?id=${extra.id}`, 'DELETE', undefined, admin);

  // Atomic module movement: collision may not delete the original.
  const original = { id: 'move-collision', examType: 'COMMON', source: 'MANUAL', modulo: 'CFC', schoolId: 'd1-school', status: 'WAITING_SCHEDULING' };
  await runtime.db.insert(schema.cfcRequests).values(original);
  await runtime.db.insert(schema.pcdRequests).values({ ...original, examType: 'PCD', modulo: 'PCD' });
  await api('requests', 'PUT', { id: original.id, examType: 'PCD' }, admin, 500);
  check((await runtime.db.select().from(schema.cfcRequests).where(eq(schema.cfcRequests.id, original.id))).length === 1);
  await runtime.db.batch([runtime.db.delete(schema.cfcRequests).where(eq(schema.cfcRequests.id, original.id)),
    runtime.db.delete(schema.pcdRequests).where(eq(schema.pcdRequests.id, original.id))]);

  const fixed = { automaticFixed: { schoolId: 'd1-school', date: '2026-11-02', slots: [{ examinerId: 'd1-examiner', scheduledTime: '08:00' }] } };
  await api('schedule-slots', 'POST', fixed, admin);
  await api('schedule-slots', 'POST', fixed, admin, 409);
  const confirmed = (await api('schedule-slots', 'GET', undefined, admin))[0];
  check(confirmed.attendanceConfirmed === true);
  const patch = { id: confirmed.id, confirmedEdit: true, scheduledDate: '2026-11-03',
    scheduledTime: '08:00', examinerId: 'd1-examiner',
    intendedCategory: 'A,B', categoryQuantities: { A: 2, B: 2 }, requestType: 'FIXA', examGroup: '1HAB' };
  await api('schedule-slots', 'PUT', patch, sessions.operator, 403);
  await api('schedule-slots', 'PUT', patch, sessions.supervisor);
  await api(`schedule-slots?id=${confirmed.id}&confirmedDelete=true`, 'DELETE', undefined, sessions.school, 403);
  await api(`schedule-slots?id=${confirmed.id}&confirmedDelete=true`, 'DELETE', undefined, sessions.supervisor);

  // Simultaneous allocations from different schools: only one can commit.
  const allocation = { schoolId: 'd1-school', examType: 'COMMON', requestType: 'FIXA',
    scheduledDate: '2026-11-04', scheduledTime: '08:00', examinerId: 'd1-examiner', status: 'SCHEDULED' };
  const concurrent = await Promise.allSettled(['race-a', 'race-b'].map((id, i) =>
    runtime.db.insert(schema.cfcScheduleSlots).values({ ...allocation, id, schoolId: `synthetic-school-${i}` })));
  check(concurrent.filter(r => r.status === 'fulfilled').length === 1);
  // A later conflict must roll back the earlier insert in the SAME batch.
  await assert.rejects(() => runtime.db.batch([
    runtime.db.insert(schema.cfcScheduleSlots).values({ ...allocation, id: 'atomic-first', scheduledDate: '2026-11-05' }),
    runtime.db.insert(schema.cfcScheduleSlots).values({ ...allocation, id: 'atomic-conflict', scheduledDate: '2026-11-05' }),
  ])); checks++;
  check((await runtime.db.select().from(schema.cfcScheduleSlots).where(eq(schema.cfcScheduleSlots.id, 'atomic-first'))).length === 0);

  // Unicode-safe chunks and a snapshot larger than the D1 row limit.
  const unicode = '😀çá'.repeat(250_000);
  check(splitD1Text(unicode).join('') === unicode);
  const bulkRows = Array.from({ length: 180 }, (_, i) => ({
    id: `bulk-${i}`, nome_candidato: 'Fictício', tipo_exame: 'COMMON', origem: 'MANUAL', status: 'WAITING_SCHEDULING',
    modulo: 'CNH_BRASIL', observacao: 'x'.repeat(15_000),
  }));
  await runtime.binding.batch(d1ImportStatements(runtime.binding as any, 'solicitacoes_cnhbrasil', bulkRows));
  const backup = await createD1Backup(runtime.db, 'manual');
  const snapshot = await readD1Backup(runtime.db, backup.id!);
  check(JSON.stringify(snapshot!.payload).length > 2_000_000);
  check(snapshot!.payload.usuarios.every((u: any) => !('senha' in u)));
  await restoreBackup(runtime.db, snapshot!.payload);
  const after = await runtime.db.select().from(schema.examiners);
  check(after[0].examRotation === true && after[0].rotationAvailability?.examsPerDay === 1);
  check((await runtime.db.select().from(schema.users))[0].password === initial[0].password);
  await assert.rejects(() => restoreBackup(runtime.db, {
    configuracoes: [{ id: 1, nome_orgao: 'Must rollback' }],
    usuarios: [{ id: 'duplicate-login', nome: 'Fake', login: 'd1.admin', perfil: 'ADMIN' }],
  })); checks++;
  check((await runtime.db.select().from(schema.systemSettings))[0].agencyName !== 'Must rollback');

  // Resend is mocked ONLY in this test process. No actual email is sent.
  let otp = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: any) => {
    if (String(input) === 'https://api.resend.com/emails') {
      const message = JSON.parse(init.body);
      otp = message.subject.match(/\d{6}/)[0];
      return Response.json({ id: 'mock-email' });
    }
    return originalFetch(input as any, init);
  };
  try {
    const secureHarness = await pagesHarness({ ...runtime.env, RESEND_API_KEY: 'synthetic-test-transport' });
    await runtime.db.update(schema.users).set({ email: 'd1-admin@example.invalid', twoFactorEnabled: true }).where(eq(schema.users.id, 'd1-admin'));
    const challenge = await secureHarness.dispatch(new Request('http://test/api/auth', {
      method: 'POST', body: JSON.stringify({ login: 'd1.admin', password: DEMO_PASSWORD }),
    }));
    const challengeData = await challenge.json() as any;
    check(challenge.status === 200 && challengeData.requiresOtp && !challengeData.sessionToken && otp.length === 6);
    await api('verify-otp', 'POST', { userId: 'd1-admin', code: otp });
    await api('verify-otp', 'POST', { userId: 'd1-admin', code: otp }, undefined, 401);
    await secureHarness.drain();
  } finally { globalThis.fetch = originalFetch; }
  await api('session', 'DELETE', undefined, sessions.school);
  await api('requests', 'GET', undefined, sessions.school, 401);
  await harness.drain();
  const marker = await runtime.binding.prepare('SELECT count(*) AS n FROM migracoes_d1').first<any>();
  check(marker.n === 1);
  const rows = await runtime.db.execute(sql`SELECT criado_em::date AS day FROM usuarios LIMIT 1`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(String(rows.rows[0].day)));
  process.stdout.write(`D1: ${checks} verificações passaram; dados fictícios; nenhuma conexão Neon ou envio real de e-mail.\n`);
} finally { await runtime.mf.dispose(); }
