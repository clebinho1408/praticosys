import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Shared policy intentionally exercised outside the scripts rootDir.
import { canRegisterInterest, interestError, interestPatch, isPendingCfcExtra, examinerCoversRequest } from '../../functions/_cfc-interest.js';
// @ts-ignore Shared validation intentionally exercised outside the scripts rootDir.
import { schoolYardsValidation, effectiveYards } from '../../functions/_school-yards.js';

const pending = { id: 'fixture', schoolId: 'school-fixture', status: 'WAITING_SCHEDULING', examType: 'COMMON', attendanceConfirmed: false, interestedExaminers: [] as any[] };
const examiner = { id: 'ex-1', name: 'EXAMINADOR FICTÍCIO' };

test('only EXAMINER profiles with a linked examiner can register interest', () => {
  for (const role of ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'CONSULTANT', 'EXAMINER', 'SCHOOL', 'INSTRUCTOR', undefined]) {
    assert.equal(canRegisterInterest(role), role === 'EXAMINER');
    const result = interestError(pending, 'CFC', role, examiner);
    assert.equal(result?.status ?? 200, role === 'EXAMINER' ? 200 : 403);
  }
  assert.equal(interestError(pending, 'CFC', 'EXAMINER', null)?.status, 403);
  assert.equal(interestError(pending, 'CFC', 'EXAMINER', { id: null, name: 'x' })?.status, 403);
});

test('interest is only accepted for pending CFC extra requests', () => {
  assert.equal(interestError(pending, 'CFC', 'EXAMINER', examiner), null);
  for (const current of [null, { ...pending, status: 'SCHEDULED' }, { ...pending, attendanceConfirmed: true },
    { ...pending, examType: 'PCD' }, { ...pending, schoolId: 'CNH_BRASIL' }, { ...pending, schoolId: 'PCD' }]) {
    assert.equal(isPendingCfcExtra(current, 'CFC'), false);
    assert.equal(interestError(current, 'CFC', 'EXAMINER', examiner)?.status, 409);
  }
  assert.equal(interestError(pending, 'PCD', 'EXAMINER', examiner)?.status, 409);
  assert.equal(interestError(pending, 'CNH_BRASIL', 'EXAMINER', examiner)?.status, 409);
});

test('registering twice is rejected and the patch is idempotent per examiner', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  const first = interestPatch(pending, examiner, now);
  assert.deepEqual(first.interestedExaminers, [{ examinerId: 'ex-1', name: 'EXAMINADOR FICTÍCIO', registeredAt: now.toISOString() }]);
  const withOne = { ...pending, interestedExaminers: first.interestedExaminers };
  assert.equal(interestError(withOne, 'CFC', 'EXAMINER', examiner)?.status, 409);
  assert.deepEqual(interestPatch(withOne, examiner, new Date()).interestedExaminers, first.interestedExaminers);
  const second = interestPatch(withOne, { id: 'ex-2', name: 'OUTRO' }, now);
  assert.equal(second.interestedExaminers.length, 2);
  assert.equal(second.interestedExaminers[0].examinerId, 'ex-1');
  // null/legacy column is treated as an empty list
  assert.equal(interestPatch({ ...pending, interestedExaminers: null }, examiner, now).interestedExaminers.length, 1);
});

test('examiner sees only requests fully covered by their categories', () => {
  const ab = ['A', 'B'];
  assert.equal(examinerCoversRequest(ab, 'A'), true);
  assert.equal(examinerCoversRequest(ab, 'B'), true);
  assert.equal(examinerCoversRequest(ab, 'A,B'), true);
  assert.equal(examinerCoversRequest(ab, 'B,A'), true);
  assert.equal(examinerCoversRequest(ab, 'C'), false);
  assert.equal(examinerCoversRequest(ab, 'A,C'), false);
  assert.equal(examinerCoversRequest(['A', 'B', 'C', 'D', 'E'], 'C,D,E'), true);
  assert.equal(examinerCoversRequest(['a', ' b '], 'A,B'), true);
  // Missing data never shows requests
  assert.equal(examinerCoversRequest([], 'A'), false);
  assert.equal(examinerCoversRequest(null, 'A'), false);
  assert.equal(examinerCoversRequest(undefined, 'A'), false);
  assert.equal(examinerCoversRequest(ab, ''), false);
  assert.equal(examinerCoversRequest(ab, null), false);
});

test('school yards validation accepts valid lists and rejects malformed entries', () => {
  const valid = { yards: [
    { id: 'y1', type: 'MOTO', address: 'RUA A, 10' },
    { id: 'y2', type: 'CARRO', address: 'RUA B, 20', reference: 'PORTAO AZUL' },
    { id: 'y3', type: 'MUDANCA', address: 'RUA C, 30', reference: null },
  ] };
  assert.equal(schoolYardsValidation(valid), null);
  assert.equal(schoolYardsValidation({}), null);          // field absent → untouched
  assert.equal(schoolYardsValidation({ yards: null }), null);
  assert.equal(schoolYardsValidation({ yards: [] }), null);
  assert.equal(schoolYardsValidation(null), null);
  for (const yards of [
    'x', {}, [null], ['x'], [[]],
    [{ id: '', type: 'MOTO', address: 'R' }],
    [{ id: 'a', type: 'MOTO', address: 'R' }, { id: 'a', type: 'CARRO', address: 'S' }],
    [{ id: 'a', type: 'BICICLETA', address: 'R' }],
    [{ id: 'a', type: 'MOTO', address: '' }],
    [{ id: 'a', type: 'MOTO', address: '   ' }],
    [{ id: 'a', type: 'MOTO', address: 'R'.repeat(301) }],
    [{ id: 'a', type: 'MOTO', address: 'R', reference: 42 }],
    [{ id: 'a', type: 'MOTO', address: 'R', reference: 'x'.repeat(301) }],
    Array.from({ length: 51 }, (_, i) => ({ id: `y${i}`, type: 'MOTO', address: 'R' })),
  ]) {
    assert.equal(typeof schoolYardsValidation({ yards }), 'string', JSON.stringify(yards).slice(0, 60));
  }
});

test('effectiveYards prefers the new list and falls back to legacy single-address fields', () => {
  const list = [{ id: 'y1', type: 'MOTO', address: 'NOVO' }];
  assert.deepEqual(effectiveYards({ yards: list, motoYardAddress: 'ANTIGO' }), list);
  // Invalid entries inside the list are dropped
  assert.deepEqual(effectiveYards({ yards: [...list, { id: 'bad', type: 'X', address: 'Y' }, { id: 'bad2', type: 'MOTO', address: '' }] }), list);
  const legacy = effectiveYards({ yards: [], motoYardAddress: 'M', carYardAddress: 'C', categoryChangeYardAddress: 'D' });
  assert.deepEqual(legacy.map(y => [y.type, y.address]), [['MOTO', 'M'], ['CARRO', 'C'], ['MUDANCA', 'D']]);
  assert.deepEqual(effectiveYards({ yards: null, carYardAddress: 'C' }).map(y => y.type), ['CARRO']);
  assert.deepEqual(effectiveYards({}), []);
  assert.deepEqual(effectiveYards(null), []);
});
