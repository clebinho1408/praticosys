import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Shared policy intentionally exercised outside the scripts rootDir.
import { canEditExtra, extraEditError, extraPatch } from '../../functions/_cfc-extra.js';

const pending = { id: 'fixture', schoolId: 'school-fixture', status: 'WAITING_SCHEDULING', examType: 'COMMON', attendanceConfirmed: false };
const edit = { id: 'fixture', extraEdit: true, requestType: 'EXTRA', examGroup: '1HAB',
  intendedCategory: 'A,B', categoryQuantities: { A: 3, B: 5 }, observation: 'Observação editada' };
const check = (body: any = edit, current: any = pending, role = 'ADMIN', module = 'CFC') =>
  extraEditError(current, module, role, body);

test('extra editing preserves existing administrative roles and rejects read-only profiles', () => {
  for (const role of ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'CONSULTANT', 'EXAMINER', 'SCHOOL', 'INSTRUCTOR']) {
    const allowed = ['ADMIN', 'SUPERVISOR', 'OPERATOR'].includes(role);
    assert.equal(canEditExtra(role), allowed);
    assert.equal(check(edit, pending, role)?.status ?? 200, allowed ? 200 : 403);
  }
  assert.equal(canEditExtra(undefined), false);
});

test('only pending CFC records can be changed; stale scheduling and other modules are rejected', () => {
  assert.equal(check(), null);
  for (const current of [null, { ...pending, status: 'SCHEDULED' }, { ...pending, attendanceConfirmed: true },
    { ...pending, examType: 'PCD' }, { ...pending, schoolId: 'CNH_BRASIL' }, { ...pending, schoolId: 'PCD' }]) {
    assert.equal(check(edit, current)?.status, 409);
  }
  assert.equal(check(edit, pending, 'ADMIN', 'PCD')?.status, 409);
  assert.equal(check(edit, pending, 'ADMIN', 'CNH_BRASIL')?.status, 409);
});

test('supports Fixa/Extra/Reposição and habilitação/mudança/misto with exact quantity keys', () => {
  for (const requestType of ['FIXA', 'EXTRA', 'REPOSICAO']) assert.equal(check({ ...edit, requestType }), null);
  assert.equal(check({ ...edit, examGroup: 'MUD_CAT', intendedCategory: 'C,D,E', categoryQuantities: { C: 2, D: 3, E: 4 } }), null);
  assert.equal(check({ ...edit, examGroup: 'MISTO', intendedCategory: 'A,C', categoryQuantities: { A: 2, C: 4 } }), null);
  for (const body of [{ ...edit, requestType: 'INVALID' }, { ...edit, examGroup: 'MISTO' },
    { ...edit, intendedCategory: '' }, { ...edit, intendedCategory: 'A,A' }, { ...edit, intendedCategory: 'PCD' },
    { ...edit, categoryQuantities: { A: 1 } }, { ...edit, categoryQuantities: { A: 1, B: 2, C: 3 } },
    { ...edit, categoryQuantities: [1, 2] }, { ...edit, observation: null }]) assert.equal(check(body)?.status, 400);
  for (const qty of [0, -1, 1.5, '3', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(check({ ...edit, categoryQuantities: { A: qty, B: 2 } })?.status, 400);
  }
  assert.equal(check({ ...edit, observation: '' }), null);
});

test('whitelisted patch cannot schedule, alter confirmation, move module or overwrite identity', () => {
  for (const field of ['status', 'attendanceConfirmed', 'scheduledDate', 'scheduledTime', 'examinerId', 'scheduleId', 'schoolId', 'examType', 'modulo', 'cpf', 'studentName']) {
    assert.equal(check({ ...edit, [field]: 'injected' })?.status, 400);
  }
  assert.deepEqual(Object.keys(extraPatch(edit)), ['requestType', 'intendedCategory', 'categoryQuantities', 'observation']);
  const saved = { ...pending, ...extraPatch(edit) };
  assert.equal(saved.status, pending.status);
  assert.equal(saved.attendanceConfirmed, false);
  assert.equal(saved.schoolId, pending.schoolId);
});
