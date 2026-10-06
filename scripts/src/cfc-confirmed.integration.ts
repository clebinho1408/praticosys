// Opt-in regression test against the running development API. Creates and
// removes only uniquely named fixtures; never edits pre-existing records.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
if (process.env.RUN_CFC_CONFIRMED_INTEGRATION !== '1') {
  throw new Error('Explicit opt-in required: RUN_CFC_CONFIRMED_INTEGRATION=1');
}
// Load the development client's source only after opting in; the scripts
// package must not compile or re-export the database package's source tree.
const { db, pool, users, drivingSchools, examiners, cfcRequests, cfcScheduleSlots, pcdScheduleSlots } =
  await import(new URL('../../lib/db/src/index.ts', import.meta.url).href);
const base = `https://${process.env.REPLIT_DEV_DOMAIN}/api`;
const prefix = `cfc-confirmed-test-${randomUUID()}`;
const schoolId = `${prefix}-school`, examinerId = `${prefix}-examiner`;
const slotId = `${prefix}-slot`, aggregateId = `${prefix}-aggregate`, candidateId = `${prefix}-candidate`, pcdSlotId = `${prefix}-pcd`;
const roles = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'CONSULTANT', 'EXAMINER', 'SCHOOL', 'INSTRUCTOR'];
const sessions = new Map(roles.map(role => [role, randomUUID()]));
const userIds = roles.map(role => `${prefix}-${role}`);
async function call(role: string, method: string, path: string, body?: any) {
  const res = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessions.get(role)}`, 'x-user-role': 'ADMIN' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() as any };
}
const appointment = {
  schoolId, examinerId, examType: 'COMMON', requestType: 'FIXA',
  intendedCategory: 'A,B', scheduledDate: '2099-05-05', scheduledTime: '08:00',
  status: 'SCHEDULED', attendanceConfirmed: true, categoryQuantities: { A: 5, B: 6 },
};
const patch = {
  scheduledDate: '2099-05-06', scheduledTime: '09:30', examinerId,
  intendedCategory: 'B', categoryQuantities: { B: 17 }, requestType: 'EXTRA', examGroup: '1HAB', confirmedEdit: true,
};
try {
  await db.insert(drivingSchools).values({ id: schoolId, name: 'Fixture CFC confirmed', doNotCreateUser: true });
  await db.insert(examiners).values({ id: examinerId, name: 'Fixture examiner', registrationNumber: prefix, categories: ['A', 'B', 'C'], canExamPCD: true });
  for (const role of roles) {
    await db.insert(users).values({ id: `${prefix}-${role}`, name: 'Fixture user', login: `${prefix}-${role}`, role, forcePasswordChange: false });
    await db.execute(sql`INSERT INTO sessoes (id, usuario_id, expira_em, criado_em)
      VALUES (${sessions.get(role)}, ${`${prefix}-${role}`}, now() + interval '15 minutes', now())`);
  }
  await db.insert(cfcScheduleSlots).values({ id: slotId, ...appointment });
  await db.insert(pcdScheduleSlots).values({ id: pcdSlotId, ...appointment, examType: 'PCD', intendedCategory: 'PCD', categoryQuantities: { PCD: 5 } });
  await db.insert(cfcRequests).values([
    { id: aggregateId, ...appointment, source: 'SCHOOL', desiredDate: '2099-05-05', modulo: 'CFC' },
    { id: candidateId, ...appointment, source: 'SCHOOL', desiredDate: '2099-05-05', modulo: 'CFC', studentName: 'Fixture candidate', cpf: prefix },
  ]);
  for (const role of roles.filter(r => !['ADMIN', 'SUPERVISOR'].includes(r))) {
    for (const [route, id] of [['/schedule-slots', slotId], ['/requests', aggregateId]]) {
      assert.equal((await call(role, 'PUT', route, { id, ...patch })).status, 403, `${role} edit ${route}`);
      assert.equal((await call(role, 'PUT', route, { id, scheduledTime: '10:30', attendanceConfirmed: false })).status, 403, `${role} direct edit ${route}`);
      assert.equal((await call(role, 'DELETE', `${route}?id=${id}`)).status, 403, `${role} direct delete ${route}`);
      assert.equal((await call(role, 'DELETE', `${route}?id=${id}&confirmedDelete=true`)).status, 403, `${role} confirmed delete ${route}`);
    }
  }
  for (const [role, route, id] of [['ADMIN', '/schedule-slots', slotId], ['SUPERVISOR', '/requests', aggregateId]]) {
    const edited = await call(role, 'PUT', route, { id, ...patch, schoolId: 'spoof', examType: 'PCD', status: 'CANCELLED' });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.schoolId, schoolId);
    assert.equal(edited.body.examType, 'COMMON');
    assert.equal(edited.body.status, 'SCHEDULED');
    assert.equal(edited.body.attendanceConfirmed, true);
    assert.deepEqual(edited.body.categoryQuantities, { B: 17 });
    assert.equal(edited.body.scheduledTime, '09:30');
    assert.equal(edited.body.requestType, 'EXTRA');
    const table = route === '/requests' ? cfcRequests : cfcScheduleSlots;
    const saved = await db.select().from(table).where(eq(table.id, id));
    assert.deepEqual(saved[0].categoryQuantities, { B: 17 });
    const changeExam = await call(role, 'PUT', route, {
      id, ...patch, examGroup: 'MUD_CAT', intendedCategory: 'C',
      categoryQuantities: { C: 9 }, requestType: 'REPOSICAO',
    });
    assert.equal(changeExam.status, 200, JSON.stringify(changeExam.body));
    assert.equal(changeExam.body.intendedCategory, 'C');
    assert.equal(changeExam.body.requestType, 'REPOSICAO');
    const mixedExam = await call(role, 'PUT', route, {
      id, ...patch, examGroup: 'MISTO', intendedCategory: 'A,C',
      categoryQuantities: { A: 5, C: 9 }, requestType: 'FIXA',
    });
    assert.equal(mixedExam.status, 200, JSON.stringify(mixedExam.body));
    const [persisted] = await db.select().from(table).where(eq(table.id, id));
    assert.equal(persisted.requestType, 'FIXA');
    assert.equal(persisted.intendedCategory, 'A,C');
    assert.equal((await call(role, 'PUT', route, { id, ...patch, categoryQuantities: { B: -1 } })).status, 400);
    assert.equal((await call(role, 'DELETE', `${route}?id=${id}&confirmedDelete=true`)).status, 200);
    assert.equal((await db.select().from(table).where(eq(table.id, id))).length, 0);
  }
  const pcdPatch = { ...patch, examGroup: 'PCD', intendedCategory: 'PCD', categoryQuantities: { PCD: 8 } };
  assert.equal((await call('SUPERVISOR', 'PUT', '/schedule-slots', { id: pcdSlotId, ...pcdPatch })).status, 200);
  assert.equal((await call('SUPERVISOR', 'DELETE', `/schedule-slots?id=${pcdSlotId}&confirmedDelete=true`)).status, 200);
  assert.equal((await call('SUPERVISOR', 'DELETE', `/requests?id=${candidateId}&confirmedDelete=true`)).status, 200);
  const [candidate] = await db.select().from(cfcRequests).where(eq(cfcRequests.id, candidateId));
  assert.equal(candidate.studentName, 'Fixture candidate');
  assert.equal(candidate.cpf, prefix);
  assert.equal(candidate.status, 'WAITING_SCHEDULING');
  assert.equal(candidate.scheduledDate, null);
  assert.equal((await db.select().from(drivingSchools).where(eq(drivingSchools.id, schoolId))).length, 1);
  assert.equal((await db.select().from(examiners).where(eq(examiners.id, examinerId))).length, 1);
  console.log('PASS: real API role restrictions, direct-call protection, persistence, strict fields, PCD slots and candidate-safe deletion.');
} finally {
  // Exact IDs only; cleanup cannot match real user data.
  await db.delete(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, slotId));
  await db.delete(pcdScheduleSlots).where(eq(pcdScheduleSlots.id, pcdSlotId));
  await db.delete(cfcRequests).where(inArray(cfcRequests.id, [aggregateId, candidateId]));
  for (const role of roles) await db.execute(sql`DELETE FROM sessoes WHERE id = ${sessions.get(role)}`);
  await db.delete(users).where(inArray(users.id, userIds));
  await db.delete(drivingSchools).where(eq(drivingSchools.id, schoolId));
  await db.delete(examiners).where(eq(examiners.id, examinerId));
  await pool.end();
}
