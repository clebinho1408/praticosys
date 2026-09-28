import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cnhBancaSuggestions } from './cnhBancaRotation.ts';

const school = (overrides = {}) => ({
  id: 'escola', name: 'Escola', city: 'CIDADE A',
  cnhBrasilProfile: true, examRotation: true, ...overrides,
});
const examiner = (overrides = {}) => ({
  id: 'ex-1', name: 'Examinador', examRotation: true, canExamCommon: true,
  rotationAvailability: {
    days: ['SEG'], cityIds: ['cidade-a'],
    defaultTime: '08:00', secondDefaultTime: '14:00', examsPerDay: 2,
  },
  ...overrides,
});
const cities = [{ id: 'cidade-a', name: 'CIDADE A' }];
const date = '2026-09-28';
const suggest = (s = school(), ex = [examiner()], existing = [], day = date) =>
  cnhBancaSuggestions(s, day, ex, cities, existing);

test('requires CNH profile and both Rodízio de Provas checkboxes', () => {
  assert.equal(suggest(school({ cnhBrasilProfile: false })).options.length, 0);
  assert.equal(suggest(school({ examRotation: false })).options.length, 0);
  assert.equal(suggest(school(), [examiner({ examRotation: false })]).options.length, 0);
});

test('requires matching school city and examiner weekday', () => {
  assert.equal(suggest(school({ city: 'CIDADE B' })).options.length, 0);
  assert.equal(suggest(school(), [examiner()], [], '2026-09-29').options.length, 0);
});

test('suggests one banca per available examiner time and avoids occupied times', () => {
  assert.deepEqual(suggest().options, [
    { examinerId: 'ex-1', time: '08:00' },
    { examinerId: 'ex-1', time: '14:00' },
  ]);
  const existing = [{
    date, time: '08:00', examinerIds: ['ex-1'], status: 'OPEN',
  }];
  assert.deepEqual(suggest(school(), [examiner()], existing).options,
    [{ examinerId: 'ex-1', time: '14:00' }]);
  assert.equal(suggest(school(), [examiner()], [
    ...existing, { date, time: '14:00', examinerIds: ['ex-1'], status: 'OPEN' },
  ]).options.length, 0);
});

test('does not suggest a time or daily capacity already occupied by CFC/PCD slots', () => {
  const occupied = [{ schoolId: 'cfc', examinerId: 'ex-1', scheduledTime: '08:00', status: 'SCHEDULED' }];
  assert.deepEqual(cnhBancaSuggestions(school(), date, [examiner()], cities, [], occupied).options,
    [{ examinerId: 'ex-1', time: '14:00' }]);
  assert.equal(cnhBancaSuggestions(school(), date, [examiner()], cities, [], [
    ...occupied, { schoolId: 'pcd', examinerId: 'ex-1', scheduledTime: '14:00', status: 'SCHEDULED' },
  ]).options.length, 0);
});