import assert from 'node:assert/strict';
import { sql, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { hash } from 'bcryptjs';
import { issuePasswordSession, consumeOtpSession, persistOtpChallenge } from '../../functions/_session-issuance.js';
import type { AuditCall } from './security-audit-cases.js';
import { auditRoles } from './security-audit-cases.js';
import * as schema from '../../db/schema.js';

export const TEST_PASSWORD = 'Synthetic-2026!';
/** ONLY call with an ephemeral database (or explicit local D1 preview). */
export async function securityFixture(db: any) {
  const password = await hash(TEST_PASSWORD, 10);
  const tokens = new Map<string, string>();
  await db.insert(schema.drivingSchools).values([
    { id: 'sec-school', name: 'Synthetic own school' },
    { id: 'sec-other-school', name: 'Synthetic foreign school' },
  ]).onConflictDoNothing();
  await db.insert(schema.examiners).values([
    { id: 'sec-examiner', name: 'Synthetic examiner', registrationNumber: 'S-1', categories: ['A', 'B'] },
    { id: 'sec-other-examiner', name: 'Synthetic other examiner', registrationNumber: 'S-2', categories: ['A'] },
  ]).onConflictDoNothing();
  await db.insert(schema.instructors).values([
    { id: 'sec-instructor', name: 'Synthetic Instructor', cpf: '00000000000' },
    { id: 'sec-other-instructor', name: 'Foreign Instructor', cpf: '00000000001' },
  ]).onConflictDoNothing();
  for (const role of auditRoles) {
    const id = `sec-${role}`;
    await db.insert(schema.users).values({
      id, name: `Synthetic ${role}`, login: `sec.${role.toLowerCase()}`, password,
      role, forcePasswordChange: false, allowedModules: ['cfc'],
      schoolId: role === 'SCHOOL' ? 'sec-school' : null,
      examinerId: role === 'EXAMINER' ? 'sec-examiner' : null,
      instructorId: role === 'INSTRUCTOR' ? 'sec-instructor' : null,
    }).onConflictDoNothing();
    const token = randomUUID();
    tokens.set(role, token);
    await db.execute(sql`INSERT INTO sessoes (id, usuario_id, expira_em) VALUES (${token}, ${id}, ${new Date(Date.now() + 600_000).toISOString()})`);
  }
  await db.insert(schema.users).values([
    { id: 'sec-null', login: 'sec.null', name: 'Synthetic null password', role: 'SCHOOL' },
    { id: 'sec-admin-null', login: 'admin', name: 'Synthetic unprovisioned admin', role: 'ADMIN' },
    { id: 'sec-unlinked', login: 'sec.unlinked', name: 'Synthetic unlinked', role: 'EXAMINER', password },
  ]).onConflictDoNothing();
  const unlinkedToken = randomUUID();
  tokens.set('UNLINKED', unlinkedToken);
  await db.execute(sql`INSERT INTO sessoes (id, usuario_id, expira_em) VALUES (${unlinkedToken}, ${'sec-unlinked'}, ${new Date(Date.now() + 600_000).toISOString()})`);
  await db.insert(schema.systemSettings).values({ id: 1, agencyName: 'Synthetic agency', riskAreaKey: 'synthetic-not-a-secret' }).onConflictDoNothing();
  await db.insert(schema.examSchedules).values([
    { id: 'sec-board', date: '2099-01-01', time: '08:00', examinerIds: ['sec-examiner'], type: 'COMMON', status: 'OPEN' },
    { id: 'sec-other-board', date: '2099-01-02', time: '08:00', examinerIds: ['sec-other-examiner'], type: 'COMMON', status: 'OPEN' },
  ]).onConflictDoNothing();
  await db.insert(schema.cfcRequests).values([
    { id: 'sec-own-cfc', schoolId: 'sec-school', source: 'SCHOOL', studentName: 'Synthetic own candidate', status: 'WAITING_SCHEDULING', modulo: 'CFC', examType: 'COMMON', intendedCategory: 'A' },
    { id: 'sec-foreign-cfc', schoolId: 'sec-other-school', source: 'SCHOOL', studentName: 'Synthetic foreign candidate', status: 'SCHEDULED', modulo: 'CFC', examType: 'COMMON', examinerId: 'sec-other-examiner', scheduleId: 'sec-other-board' },
    { id: 'sec-assigned-cfc', schoolId: 'sec-school', source: 'SCHOOL', studentName: 'Synthetic assigned candidate', status: 'SCHEDULED', modulo: 'CFC', examType: 'COMMON', examinerId: 'sec-examiner', attendanceConfirmed: false },
  ]).onConflictDoNothing();
  await db.insert(schema.cnhbrasilRequests).values([
    { id: 'sec-own-cnh', cpf: '00000000001', source: 'MANUAL', studentName: 'Synthetic instructor candidate', instructor: 'Moto: Synthetic Instructor / Carro: Foreign Instructor', status: 'WAITING_SCHEDULING', modulo: 'CNH_BRASIL', examType: 'COMMON' },
    { id: 'sec-foreign-cnh', cpf: '00000000002', source: 'MANUAL', studentName: 'Synthetic foreign CNH', instructor: 'Foreign Instructor', status: 'WAITING_SCHEDULING', modulo: 'CNH_BRASIL', examType: 'COMMON' },
    { id: 'sec-indirect-cnh', cpf: '00000000003', source: 'MANUAL', studentName: 'Synthetic indirect examiner', instructor: 'Foreign Instructor', status: 'SCHEDULED', scheduleId: 'sec-board', modulo: 'CNH_BRASIL', examType: 'COMMON' },
  ]).onConflictDoUpdate({ target: schema.cnhbrasilRequests.id,
    // Explicitly invalid fictitious CPF; a missing value is intentionally hidden
    // as an empty auto-generated slot by the existing candidate UI.
    set: { cpf: sql`COALESCE(${schema.cnhbrasilRequests.cpf}, '00000000001')` } });
  return tokens;
}

export async function verifySecurity(call: AuditCall, db: any) {
  let assertions = 0;
  const check = (actual: any, expected: any, label: string) => { assert.deepEqual(actual, expected, label); assertions++; };
  for (const role of [null, 'INVALID']) {
    check((await call(role, 'GET', 'users')).status, 401, 'forged headers are not a session');
    check((await call(role, 'GET', 'events')).status, 401, 'events require a session');
  }
  for (const login of ['sec.null', 'admin', 'not-existing']) {
    const r = await call(null, 'POST', 'auth', { login, password: TEST_PASSWORD });
    check(r.status, 401, 'null password and bootstrap blocked');
    check(r.body.sessionToken, undefined, 'no session on invalid credentials');
    check(r.body.error, 'Login ou senha inválidos.', 'uniform account response');
  }
  check((await call(null, 'POST', 'setup', { initialPassword: TEST_PASSWORD })).status, 401, 'no public setup');
  for (const role of auditRoles) {
    const settings = await call(role, 'GET', 'settings');
    check(settings.status, 200, `${role} can read display settings`);
    check(!!settings.body.riskAreaKey, role === 'ADMIN', `${role} secret minimization`);
    check((await call(role, 'GET', 'users')).status, role === 'ADMIN' ? 200 : 403, `${role} user management`);
    check((await call(role, 'GET', 'cnh-logs')).status, role === 'ADMIN' ? 200 : 403, `${role} audit read matrix`);
    check((await call(role, 'PUT', 'settings', { agencyName: 'Synthetic change' })).status, role === 'ADMIN' ? 200 : 403, `${role} settings write`);
    if (role !== 'ADMIN') check((await call(role, 'POST', 'risk-area', { action: 'RESET_DATA' })).status, 403, `${role} cannot reset`);
    check((await call(role, 'PUT', 'instructors', { id: 'sec-other-instructor', name: 'Unauthorized change' })).status, role === 'ADMIN' ? 200 : 403, `${role} instructor mutation`);
    const requests = await call(role, 'GET', 'requests');
    check(requests.status, 200, `${role} legitimate list`);
    if (['SUPERVISOR', 'OPERATOR'].includes(role)) {
      check(requests.body.some((r: any) => r.modulo === 'CNH_BRASIL'), false, `${role} module restriction`);
      check((await call(role, 'PUT', 'requests', { id: 'sec-foreign-cnh', observation: 'Denied' })).status, 403, `${role} direct foreign module`);
      check((await call(role, 'PUT', 'requests', { id: 'sec-own-cfc', observation: 'Allowed staff edit' })).status, 200, `${role} retains CFC mutation`);
    }
    if (role === 'SCHOOL') {
      check(requests.body.some((r: any) => r.id === 'sec-foreign-cfc'), false, 'foreign school not listed');
      check((await call(role, 'DELETE', 'requests?id=sec-foreign-cfc')).status, 403, 'foreign delete blocked');
      check((await call(role, 'PUT', 'requests', { id: 'sec-own-cfc', schoolId: 'sec-other-school' })).status, 403, 'ownership transfer blocked');
      check((await call(role, 'PUT', 'requests', { id: 'sec-assigned-cfc', attendanceConfirmed: true })).status, 200, 'school can confirm assigned exam');
    }
    if (role === 'INSTRUCTOR') {
      check(requests.body.some((r: any) => r.id === 'sec-own-cnh'), true, 'A/B exact instructor relation');
      check(requests.body.some((r: any) => r.id === 'sec-foreign-cnh'), false, 'foreign instructor candidate denied');
    }
    if (role === 'EXAMINER') {
      check(requests.body.some((r: any) => r.id === 'sec-indirect-cnh'), true, 'indirect examiner relation');
      check(requests.body.some((r: any) => r.id === 'sec-foreign-cfc'), false, 'foreign examiner schedule denied');
      const interested = await call(role, 'PUT', 'requests', { id: 'sec-own-cfc', registerInterest: true });
      check(interested.status, 200, 'examiner can register interest');
      check(interested.body.studentName, undefined, 'interest response does not disclose candidate identity');
      check((await call(role, 'PUT', 'requests', { id: 'sec-foreign-cfc', result: 'APPROVED', examHistory: [] })).status, 403, 'examiner foreign result denied');
    }
    if (role === 'CONSULTANT') check((await call(role, 'PUT', 'requests', { id: 'sec-own-cfc', observation: 'Denied' })).status, 403, 'consultant cannot write');
  }
  check((await call('UNLINKED', 'GET', 'requests')).status, 403, 'missing link fails closed');
  check((await call('ADMIN', 'PUT', 'users', { id: 'sec-SCHOOL', password: null })).status, 400, 'null reset denied');
  check((await call('ADMIN', 'PUT', 'users', { id: 'sec-SCHOOL', password: '$2b$fake' })).status, 400, 'client hashes denied');
  check((await call('ADMIN', 'POST', 'users', { name: 'Synthetic', login: 'sec.new', role: 'SCHOOL', password: TEST_PASSWORD })).status, 200, 'provision user');
  const [provisioned] = await db.select().from(schema.users).where(eq(schema.users.login, 'sec.new'));
  check(provisioned.password.startsWith('$2'), true, 'provisioned password hashed');
  check(provisioned.forcePasswordChange, true, 'first access must change password');
  check((await call('ADMIN', 'PUT', 'requests', { id: 'sec-foreign-cnh', observation: 'Audit actor test' })).status, 200, 'admin mutation');
  const logs = await call('ADMIN', 'GET', 'cnh-logs?limit=999999&offset=-20');
  check(logs.status, 200, 'bounded admin logs');
  const actor = logs.body.find((r: any) => r.entity_id === 'sec-foreign-cnh');
  check(actor?.user_id, 'sec-ADMIN', 'audit actor comes from session');
  check(actor?.user_role, 'ADMIN', 'verified audit role');
  check((await call('SCHOOL', 'GET', 'cnh-logs')).status, 403, 'school cannot read logs');
  check((await call('ADMIN', 'PUT', 'settings', { arbitraryColumn: true })).status, 400, 'settings explicit fields');
  check((await call('ADMIN', 'POST', 'risk-area', { action: 'RESET_DATA' })).status, 409, 'destructive confirmation required');
  check((await call('ADMIN', 'POST', 'backups', { payload: {} })).status, 409, 'restore confirmation required');
  await db.update(schema.users).set({ allowedModules: [], allowedLocationIds: [] }).where(eq(schema.users.id, 'sec-OPERATOR'));
  check((await call('OPERATOR', 'GET', 'requests')).body.some((r: any) => r.id === 'sec-foreign-cnh'), true, 'empty modules retain all exam modules');
  await db.update(schema.users).set({ allowedModules: ['cnh'], allowedLocationIds: ['sec-location'] }).where(eq(schema.users.id, 'sec-OPERATOR'));
  check((await call('OPERATOR', 'GET', 'requests')).body.some((r: any) => r.id === 'sec-indirect-cnh'), false, 'location restriction in indirect request');
  check((await call('OPERATOR', 'PUT', 'requests', { id: 'sec-indirect-cnh', observation: 'Denied' })).status, 403, 'location direct mutation denied');
  await db.update(schema.users).set({ allowedModules: ['cfc'], allowedLocationIds: [] }).where(eq(schema.users.id, 'sec-OPERATOR'));
  await db.update(schema.users).set({ allowedModules: ['cfc', 'cadastro'], allowedCadastroTabs: ['instrutores'] }).where(eq(schema.users.id, 'sec-SUPERVISOR'));
  check((await call('SUPERVISOR', 'PUT', 'instructors', { id: 'sec-other-instructor', name: 'Foreign Instructor' })).status, 200, 'supervisor configured registry retained');
  check((await call('SUPERVISOR', 'PUT', 'schools', { id: 'sec-other-school', name: 'Denied' })).status, 403, 'unconfigured registry tab denied');
  await db.update(schema.users).set({ allowedCadastroTabs: [] }).where(eq(schema.users.id, 'sec-SUPERVISOR'));
  check((await call('SUPERVISOR', 'PUT', 'instructors', { id: 'sec-other-instructor', name: 'Denied' })).status, 403, 'empty registry tabs grant no tab');
  const [beforeReset] = await db.select().from(schema.users).where(eq(schema.users.id, 'sec-SCHOOL'));
  check((await call('ADMIN', 'POST', 'backups', {
    confirmation: 'RESTAURAR BACKUP',
    payload: { usuarios: [{ id: 'sec-SCHOOL', nome: beforeReset.name, login: beforeReset.login, perfil: beforeReset.role, senha: 'plaintext-attack' }] },
  })).status, 200, 'authorized restore works without importing passwords');
  const [afterRestore] = await db.select().from(schema.users).where(eq(schema.users.id, 'sec-SCHOOL'));
  check(afterRestore.password, beforeReset.password, 'restore cannot replace hash with plaintext');
  const issueOtp = async (id: string, code: string, expired = false) => {
    await db.insert(schema.otpCodes).values({
      id, userId: 'sec-SCHOOL', code: createHash('sha256').update(code).digest('hex'),
      expiresAt: new Date(Date.now() + (expired ? -600_000 : 600_000)), failedAttempts: 0, used: false,
    });
  };
  await issueOtp('sec-otp-valid', '482913');
  const otp = await call(null, 'POST', 'verify-otp', { userId: 'sec-SCHOOL', code: '482913' });
  check(otp.status, 200, 'valid OTP issues session');
  check(typeof otp.body.sessionToken, 'string', 'OTP session returned');
  check((await call(null, 'POST', 'verify-otp', { userId: 'sec-SCHOOL', code: '482913' })).status, 401, 'OTP single use');
  await issueOtp('sec-otp-expired', '482914', true);
  check((await call(null, 'POST', 'verify-otp', { userId: 'sec-SCHOOL', code: '482914' })).status, 401, 'expired OTP denied');
  await issueOtp('sec-otp-attempts', '482915');
  for (let n = 0; n < 5; n++) check((await call(null, 'POST', 'verify-otp', { userId: 'sec-SCHOOL', code: '000000' })).status, 401, 'OTP failed attempt');
  check((await call(null, 'POST', 'verify-otp', { userId: 'sec-SCHOOL', code: '482915' })).status, 401, 'OTP cannot be used after five failures');
  const [verifiedBeforeChange] = await db.select().from(schema.users).where(eq(schema.users.id, 'sec-SCHOOL'));
  await issueOtp('sec-otp-concurrent', '482916');
  const parallelTokens = await Promise.all([0, 1].map(() =>
    consumeOtpSession(db, verifiedBeforeChange, createHash('sha256').update('482916').digest('hex'))));
  check(parallelTokens.filter(Boolean).length, 1, 'concurrent OTP verification issues only one session');
  check((await call('SCHOOL', 'POST', 'users/change-own-password', { password: 'Synthetic-new!' })).status, 409, 'explicit session confirmation');
  check((await call('SCHOOL', 'POST', 'users/change-own-password', { password: 'Synthetic-new!', confirmSessionRevocation: true, currentPassword: 'incorrect' })).status, 403, 'current password verification');
  check((await call('SCHOOL', 'POST', 'users/change-own-password', { password: 'Synthetic-new!', confirmSessionRevocation: true, currentPassword: TEST_PASSWORD })).status, 200, 'own password change');
  check(await issuePasswordSession(db, verifiedBeforeChange), null, 'login verified before password change cannot mint a late session');
  check(await persistOtpChallenge(db, verifiedBeforeChange, 'synthetic-old-hash', new Date(Date.now() + 600_000)), false, 'old credentials cannot issue late OTP after password change');
  check((await call('SCHOOL', 'GET', 'session')).status, 200, 'current PWA session retained');
  check((await call(`SESSION:${otp.body.sessionToken}`, 'GET', 'session')).status, 401, 'other OTP session revoked by own change');
  const login = await call(null, 'POST', 'auth', { login: 'sec.school', password: 'Synthetic-new!' });
  check(login.status, 200, 'new password usable');
  check((await call(null, 'POST', 'auth', { login: 'sec.school', password: TEST_PASSWORD })).status, 401, 'old password rejected');
  check((await call('ADMIN', 'PUT', 'users', { id: 'sec-SCHOOL', password: 'Recovery-2026!', confirmSessionRevocation: true })).status, 200, 'admin recovery with explicit confirmation');
  check((await call(`SESSION:${login.body.sessionToken}`, 'GET', 'session')).status, 401, 'recovery revokes old sessions');
  const recovered = await call(null, 'POST', 'auth', { login: 'sec.school', password: 'Recovery-2026!' });
  check(recovered.status, 200, 'recovered credential usable');
  check(recovered.body.forcePasswordChange, true, 'recovery enforces first access');
  check((await call(`SESSION:${recovered.body.sessionToken}`, 'GET', 'requests')).status, 403, 'first access cannot bypass password change');
  check((await call(`SESSION:${recovered.body.sessionToken}`, 'POST', 'users/change-own-password', {
    password: 'First-access-2026!', confirmSessionRevocation: true,
  })).status, 200, 'first access can replace temporary credential');
  check((await call(`SESSION:${recovered.body.sessionToken}`, 'GET', 'requests')).status, 200, 'first access retains same session');
  for (let n = 0; n < 11; n++) {
    const r = await call(null, 'POST', 'auth', { login: 'sec.rate', password: 'incorrect' });
    check(r.status, n < 10 ? 401 : 429, 'persistent password limit');
  }
  const counters = await db.execute(sql`SELECT COUNT(*) AS count FROM limites_autenticacao`);
  check(Number((counters.rows ?? counters)[0].count) > 0, true, 'limits persisted in shared database');
  for (let n = 0; n < 11; n++) {
    const r = await call('INSTRUCTOR', 'POST', 'users/change-own-password', {
      password: 'Synthetic-unused!', currentPassword: 'incorrect', confirmSessionRevocation: true,
    });
    check(r.status, n < 10 ? 403 : 429, 'current-password guesses are persistently limited');
  }
  check((await call('ADMIN', 'POST', 'risk-area', {
    action: 'RESET_DATA', confirmation: 'APAGAR DADOS OPERACIONAIS', securityKey: 'synthetic-not-a-secret',
  })).status, 200, 'authorized cleanup atomically works on synthetic data');
  check((await call('ADMIN', 'GET', 'requests')).body.length, 0, 'operational cleanup removed candidates');
  return assertions;
}
