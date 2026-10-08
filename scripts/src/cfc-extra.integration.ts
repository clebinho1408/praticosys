// Opt-in fixture regression: never edits or removes pre-existing records.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';

if (process.env.RUN_CFC_EXTRA_INTEGRATION !== '1') {
  throw new Error('Explicit opt-in required: RUN_CFC_EXTRA_INTEGRATION=1');
}
const { db, pool, users, drivingSchools, cfcRequests, cfcScheduleSlots } =
  await import(new URL('../../lib/db/src/index.ts', import.meta.url).href);
const base = `https://${process.env.REPLIT_DEV_DOMAIN}/api`;
const prefix = `cfc-extra-test-${randomUUID()}`;
const schoolId = `${prefix}-school`, requestId = `${prefix}-request`, slotId = `${prefix}-slot`;
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
const pending = {
  schoolId, examType: 'COMMON', requestType: 'EXTRA', intendedCategory: 'A,B',
  status: 'WAITING_SCHEDULING', attendanceConfirmed: false, observation: '[Qtd:A=3,B=4] Pedido legado',
};
const patch = {
  extraEdit: true, requestType: 'REPOSICAO', examGroup: 'MISTO', intendedCategory: 'A,C',
  categoryQuantities: { A: 7, C: 9 }, observation: 'Observação atualizada',
};
try {
  await db.insert(drivingSchools).values({ id: schoolId, name: 'Fixture CFC extra', doNotCreateUser: true });
  for (const role of roles) {
    await db.insert(users).values({ id: `${prefix}-${role}`, name: 'Fixture user', login: `${prefix}-${role}`, role, forcePasswordChange: false });
    await db.execute(sql`INSERT INTO sessoes (id, usuario_id, expira_em, criado_em)
      VALUES (${sessions.get(role)}, ${`${prefix}-${role}`}, now() + interval '15 minutes', now())`);
  }
  await db.insert(cfcRequests).values({ id: requestId, ...pending, source: 'SCHOOL', desiredDate: '', modulo: 'CFC' });
  await db.insert(cfcScheduleSlots).values({ id: slotId, ...pending });
  for (const [route, id, table] of [
    ['/requests', requestId, cfcRequests], ['/schedule-slots', slotId, cfcScheduleSlots],
  ] as const) {
    for (const role of roles) {
      const result = await call(role, 'PUT', route, { id, ...patch });
      assert.equal(result.status, ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(role) ? 200 : 403, `${role} ${route}`);
    }
    assert.equal((await call('ADMIN', 'PUT', route, { id, ...patch, scheduledDate: '2099-05-05' })).status, 400);
    assert.equal((await call('ADMIN', 'PUT', route, { id, ...patch, status: 'SCHEDULED' })).status, 400);
    assert.equal((await call('ADMIN', 'PUT', route, { id, ...patch, categoryQuantities: { A: -1, C: 9 } })).status, 400);
    const [saved] = await db.select().from(table).where(eq(table.id, id));
    assert.deepEqual(saved.categoryQuantities, { A: 7, C: 9 });
    assert.equal(saved.requestType, 'REPOSICAO');
    assert.equal(saved.intendedCategory, 'A,C');
    assert.equal(saved.observation, 'Observação atualizada');
    assert.equal(saved.status, 'WAITING_SCHEDULING');
    assert.equal(saved.attendanceConfirmed, false);
    assert.equal(saved.schoolId, schoolId);
    assert.equal(saved.examType, 'COMMON');
    assert.equal(saved.scheduledDate, null);
    assert.equal(saved.scheduledTime, null);
    assert.equal(saved.examinerId, null);
    const reloaded = (await call('ADMIN', 'GET', route)).body.find((row: any) => row.id === id);
    assert.deepEqual(reloaded.categoryQuantities, { A: 7, C: 9 });
    assert.equal(reloaded.observation, 'Observação atualizada');
    await db.update(table).set({ status: 'SCHEDULED' }).where(eq(table.id, id));
    assert.equal((await call('ADMIN', 'PUT', route, { id, ...patch })).status, 409);
    assert.equal((await db.select().from(table).where(eq(table.id, id)))[0].status, 'SCHEDULED');
  }
  console.log('PASS: extra request and slot edits, stored roles, strict fields, persistence after GET, queue preservation and stale-state protection.');
} finally {
  await db.delete(cfcRequests).where(eq(cfcRequests.id, requestId));
  await db.delete(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, slotId));
  for (const role of roles) await db.execute(sql`DELETE FROM sessoes WHERE id = ${sessions.get(role)}`);
  await db.delete(users).where(inArray(users.id, userIds));
  await db.delete(drivingSchools).where(eq(drivingSchools.id, schoolId));
  await pool.end();
}
