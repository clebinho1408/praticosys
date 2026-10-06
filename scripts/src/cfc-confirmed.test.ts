import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Shared policy intentionally exercised outside the scripts rootDir.
import { canManageConfirmed, isConfirmedCfc, confirmedAccessError, confirmedPatch, validateConfirmedFields, validateConfirmedEdit, clearAppointment, hasCandidateIdentity } from '../../functions/_cfc-confirmed.js';

const confirmed = {
  id: 'isolated-fixture', status: 'SCHEDULED', attendanceConfirmed: true,
  schoolId: 'school-fixture', examType: 'COMMON', requestType: 'FIXA', intendedCategory: 'A,B',
  examinerId: 'examiner-fixture', scheduledDate: '2099-05-05', scheduledTime: '08:00',
  categoryQuantities: { A: 0, B: 12 },
};
const edit = { ...confirmedPatch(confirmed), confirmedEdit: true };

test('only ADMIN and SUPERVISOR manage stored confirmed CFC appointments', () => {
  for (const role of ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'CONSULTANT', 'EXAMINER', 'SCHOOL', 'INSTRUCTOR', undefined]) {
    const manager = role === 'ADMIN' || role === 'SUPERVISOR';
    assert.equal(canManageConfirmed(role), manager);
    assert.equal(!!confirmedAccessError(confirmed, 'CFC', false, role, edit), !manager);
    for (const field of ['scheduledDate', 'scheduledTime', 'examinerId', 'intendedCategory', 'categoryQuantities', 'requestType', 'schoolId', 'examType', 'modulo', 'scheduleId']) {
      assert.equal(!!confirmedAccessError(confirmed, 'CFC', false, role, { [field]: 'different' }), !manager, field);
    }
  }
});

test('uses stored confirmation and module; preserves unrelated workflows', () => {
  assert.equal(isConfirmedCfc(confirmed, 'CFC'), true);
  assert.equal(isConfirmedCfc(confirmed, 'CNH_BRASIL'), false);
  assert.equal(isConfirmedCfc(confirmed, 'PCD', true), true);
  assert.equal(isConfirmedCfc({ ...confirmed, status: 'DONE' }, 'CFC'), false);
  assert.ok(confirmedAccessError({ ...confirmed, status: 'CANCELLED' }, 'CFC', false, 'ADMIN', edit));
  assert.ok(confirmedAccessError(confirmed, 'CFC', false, 'OPERATOR', { attendanceConfirmed: false }));
  assert.equal(confirmedAccessError(confirmed, 'CFC', false, 'OPERATOR', { status: 'CANCELLED', attendanceConfirmed: false }), null);
  assert.equal(confirmedAccessError(confirmed, 'CFC', false, 'OPERATOR', { status: 'DONE' }), null);
  assert.equal(confirmedAccessError(confirmed, 'CFC', false, 'CONSULTANT', { observation: 'unrelated' }), null);
});

test('edit accepts the requested fields without confirmation/module changes', () => {
  assert.deepEqual(confirmedPatch({ ...edit, schoolId: 'other', status: 'CANCELLED', attendanceConfirmed: false, modulo: 'PCD', observation: 'other' }),
    confirmedPatch(confirmed));
  assert.equal(validateConfirmedFields(confirmed, edit, '2099-05-01'), null);
  assert.equal(validateConfirmedFields(confirmed, { scheduledTime: '09:00' }, '2099-05-01'), null);
});

test('validates real dates, time, examiner, categories and integral nonnegative vacancies', () => {
  for (const patch of [
    { scheduledDate: '2099-02-30' }, { scheduledDate: '2098-05-05' }, { scheduledDate: null },
    { scheduledTime: '24:00' }, { scheduledTime: 'abc' }, { examinerId: '' },
    { intendedCategory: '' }, { intendedCategory: 'A,A' }, { requestType: 'INVALID' },
    { intendedCategory: 'A,C', examGroup: '1HAB' },
    { intendedCategory: 'PCD' }, { categoryQuantities: null }, { categoryQuantities: { A: 0 } },
    { categoryQuantities: { A: -1, B: 12 } }, { categoryQuantities: { A: 1.5, B: 12 } },
    { categoryQuantities: { A: '2', B: 12 } }, { categoryQuantities: { A: 0, B: 12, C: 1 } },
  ]) assert.ok(validateConfirmedFields(confirmed, { ...edit, ...patch }, '2099-05-01'), JSON.stringify(patch));
});

test('exam and request type edits persist through the allowed patch', () => {
  for (const requestType of ['FIXA', 'EXTRA', 'REPOSICAO']) {
    const mixed = { ...edit, requestType, examGroup: 'MISTO', intendedCategory: 'A,C', categoryQuantities: { A: 3, C: 4 } };
    assert.equal(validateConfirmedFields(confirmed, mixed, '2099-05-01'), null);
    assert.equal(confirmedPatch(mixed).requestType, requestType);
    assert.equal(confirmedPatch(mixed).intendedCategory, 'A,C');
    assert.equal('examGroup' in confirmedPatch(mixed), false);
  }
  assert.ok(validateConfirmedFields(confirmed, { ...edit, examGroup: 'MISTO' }, '2099-05-01'));
  assert.equal(validateConfirmedFields(confirmed, { ...edit, examGroup: 'MUD_CAT', intendedCategory: 'C', categoryQuantities: { C: 4 } }, '2099-05-01'), null);
});

test('candidate appointment removal preserves identity; aggregates are distinguishable', () => {
  assert.equal(hasCandidateIdentity(confirmed), false);
  assert.equal(hasCandidateIdentity({ ...confirmed, cpf: 'fixture' }), true);
  assert.equal(hasCandidateIdentity({ ...confirmed, studentName: 'Fixture' }), true);
  const candidate = { ...confirmed, cpf: 'fixture', studentName: 'Fixture', ...clearAppointment };
  assert.equal(candidate.cpf, 'fixture');
  assert.equal(candidate.studentName, 'Fixture');
  assert.equal(candidate.status, 'WAITING_SCHEDULING');
  assert.equal(candidate.scheduleId, null);
  assert.equal(candidate.attendanceConfirmed, false);
});

const tables = { examiners: 'examiners', systemSettings: 'settings', blockedDates: 'blocked' };
function fakeDb(examiners: any[], settings: any[] = [], blocked: any[] = []) {
  const values: Record<string, any[]> = { examiners, settings, blocked };
  return { select: () => ({ from: async (table: string) => values[table] }) };
}

test('checks stored examiner compatibility and blocked dates', async () => {
  const examiner = { id: confirmed.examinerId, categories: ['A', 'B'], canExamPCD: true };
  assert.equal(await validateConfirmedEdit(fakeDb([examiner]), tables, confirmed, edit), null);
  assert.ok(await validateConfirmedEdit(fakeDb([]), tables, confirmed, edit));
  assert.ok(await validateConfirmedEdit(fakeDb([{ ...examiner, categories: ['C'] }]), tables, confirmed, edit));
  assert.ok(await validateConfirmedEdit(fakeDb([examiner], [], [{ date: confirmed.scheduledDate }]), tables, confirmed, edit));
  const pcd = { ...confirmed, examType: 'PCD', intendedCategory: 'PCD', categoryQuantities: { PCD: 5 } };
  assert.equal(await validateConfirmedEdit(fakeDb([examiner]), tables, pcd, { ...confirmedPatch(pcd), confirmedEdit: true }), null);
  assert.ok(await validateConfirmedEdit(fakeDb([{ ...examiner, canExamPCD: false }]), tables, pcd, { ...confirmedPatch(pcd), confirmedEdit: true }));
});
