import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-ignore Frontend helper intentionally exercised outside the scripts rootDir.
import { confirmedVacancies } from '../../artifacts/praticosys/src/lib/cfcConfirmedVacancies';
// @ts-ignore Frontend types intentionally exercised outside the scripts rootDir.
import { RequestType, type Examiner } from '../../artifacts/praticosys/src/types';

const examiner: Examiner = {
  id: 'examiner-fixture', name: 'Examinador de teste', registrationNumber: 'fixture',
  defaultMaxSlotsA: 20, defaultMaxSlotsB: 15, defaultMaxSlotsMudanca: 5,
};
const request = {
  requestType: RequestType.FIXA, examinerId: examiner.id,
  categoryQuantities: { A: 99, B: 99 },
};

test('fixed confirmed rows use all three capacities from the assigned examiner', () => {
  assert.deepEqual(confirmedVacancies(request, [examiner]), [['A', 20], ['B', 15], ['C/D/E', 5]]);
  assert.deepEqual(confirmedVacancies(request, [{ ...examiner, defaultMaxSlotsA: 0 }]),
    [['A', 0], ['B', 15], ['C/D/E', 5]]);
});

test('changing examiner or its current settings changes displayed capacities', () => {
  const other = { ...examiner, id: 'other', defaultMaxSlotsA: 8 };
  assert.deepEqual(confirmedVacancies({ ...request, examinerId: 'other' }, [examiner, other]),
    [['A', 8], ['B', 15], ['C/D/E', 5]]);
});

test('missing examiner or unset capacities do not invent vacancies or use old quantities', () => {
  assert.deepEqual(confirmedVacancies(request, []), []);
  assert.deepEqual(confirmedVacancies(request, [{ ...examiner,
    defaultMaxSlotsA: null, defaultMaxSlotsB: undefined, defaultMaxSlotsMudanca: null }]), []);
});

test('extra and replacement appointments retain their own released quantities', () => {
  for (const requestType of [RequestType.EXTRA, RequestType.REPOSICAO]) {
    assert.deepEqual(confirmedVacancies({ ...request, requestType }, [examiner]), [['A', 99], ['B', 99]]);
    assert.deepEqual(confirmedVacancies({ ...request, requestType, categoryQuantities: null }, [examiner]), []);
  }
});
