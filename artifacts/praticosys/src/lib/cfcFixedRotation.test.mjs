import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planFixedScales, rotationCandidates } from './cfcFixedRotation.ts';

const date = '2026-09-28'; // segunda-feira
const cities = [{ id: 'cidade-a', name: 'CIDADE A' }, { id: 'cidade-b', name: 'CIDADE B' }];
const school = (id, overrides = {}) => ({
  id, name: id, city: 'CIDADE A', examRotation: true,
  mainSchedule: { active: true, frequency: '1_WEEK', days: ['SEG'],
    slots: [{ time: '06:00', examiner: 'antigo' }] },
  provisionalSchedule: { active: false, frequency: '1_WEEK', days: [], slots: [] },
  ...overrides,
});
const examiner = (id, cityIds = ['cidade-a'], overrides = {}) => ({
  id, name: id, examRotation: true, canExamCommon: true,
  rotationAvailability: {
    days: ['SEG'], cityIds, defaultTime: '08:00', secondDefaultTime: '',
    examsPerDay: 1,
  },
  ...overrides,
});
const plan = (overrides = {}) => planFixedScales({
  date, selectedSchoolIds: ['escola'], schools: [school('escola')],
  examiners: [examiner('ex-a'), examiner('ex-b')], cities, commitments: [],
  ...overrides,
});

test('resolves school city name against examiner city IDs and ignores old slot time/examiner', () => {
  const result = plan({ examiners: [examiner('outra-cidade', ['cidade-b']), examiner('ex-a')] });
  assert.deepEqual(result.plans[0].slots, [{ examinerId: 'ex-a', scheduledTime: '08:00' }]);
  assert.equal(result.issues.length, 0);
  assert.equal(rotationCandidates(school('escola', { city: 'CIDADE B' }), 'SEG',
    [examiner('ex-a')], cities).eligible.length, 0);
});

test('alternates examiner on the next date based on previous FIXA assignments', () => {
  const result = plan({ date: '2026-10-05', commitments: [{
    schoolId: 'escola', examinerId: 'ex-a', scheduledDate: date,
    scheduledTime: '08:00', requestType: 'FIXA', status: 'DONE',
  }] });
  assert.equal(result.plans[0].slots[0].examinerId, 'ex-b');
});

test('uses first and second configured times for two exams, never old slot times', () => {
  const two = school('escola', { mainSchedule: { active: true, frequency: '2_DAY',
    days: ['SEG'], slots: [{ time: '06:00', examiner: 'antigo' }, { time: '06:30', examiner: 'antigo' }] } });
  const result = plan({ schools: [two], examiners: [examiner('ex-a', ['cidade-a'], {
    rotationAvailability: { days: ['SEG'], cityIds: ['cidade-a'],
      defaultTime: '14:00', secondDefaultTime: '08:00', examsPerDay: 2 },
  })] });
  assert.deepEqual(result.plans[0].slots.map(slot => slot.scheduledTime), ['14:00', '08:00']);
});

test('does not overbook examiner when another school already occupies a configured time', () => {
  const result = plan({ examiners: [examiner('ex-a')], commitments: [{
    schoolId: 'outra', examinerId: 'ex-a', scheduledDate: date,
    scheduledTime: '08:00', requestType: 'FIXA', status: 'SCHEDULED',
  }] });
  assert.equal(result.plans.length, 0);
  assert.match(result.issues[0].reason, /capacidade/);
});

test('does not generate incomplete school if fewer examiners are available than slots', () => {
  const two = school('escola', { mainSchedule: { active: true, frequency: '2_DAY',
    days: ['SEG'], slots: [{ time: '06:00', examiner: 'antigo' }, { time: '07:00', examiner: 'antigo' }] } });
  const result = plan({ schools: [two], examiners: [examiner('ex-a')] });
  assert.equal(result.plans.length, 0);
  assert.equal(result.issues.length, 1);
});

test('does not recreate FIXA for the same school/date; ignores canceled attempts', () => {
  const commitment = { schoolId: 'escola', examinerId: 'ex-a', scheduledDate: date,
    scheduledTime: '08:00', requestType: 'FIXA', status: 'SCHEDULED' };
  assert.equal(plan({ commitments: [commitment] }).plans.length, 0);
  assert.equal(plan({ commitments: [{ ...commitment, status: 'CANCELLED' }] }).plans.length, 1);
});

test('main/provisional selection and non-rotation schools keep their configured time', () => {
  const result = plan({ schools: [school('escola', { examRotation: false,
    provisionalSchedule: { active: true, frequency: '15_DAYS', days: ['SEG'],
      slots: [{ time: '11:00', examiner: 'fixo' }] } })] });
  assert.deepEqual(result.plans[0].slots, [{ examinerId: 'fixo', scheduledTime: '11:00' }]);
});

test('does not use a city that is missing from city registry', () => {
  const result = plan({ schools: [school('escola', { city: 'CIDADE INEXISTENTE' })] });
  assert.equal(result.plans.length, 0);
  assert.match(result.issues[0].reason, /Cidade/);
});

test('rotation requires both school and examiner checkboxes enabled', () => {
  const disabledExaminer = examiner('ex-a', ['cidade-a'], { examRotation: false });
  const rotated = plan({ examiners: [disabledExaminer] });
  assert.equal(rotated.plans.length, 0);
  assert.match(rotated.issues[0].reason, /Nenhum examinador/);

  const normalSchool = school('escola', { examRotation: false });
  const normal = plan({ schools: [normalSchool], examiners: [disabledExaminer] });
  assert.deepEqual(normal.plans[0].slots, [{ examinerId: 'antigo', scheduledTime: '06:00' }]);
  assert.equal(rotationCandidates(normalSchool, 'SEG', [examiner('ex-b')], cities).eligible.length, 0);
});

test('distributes two schools between examiners with capacity for one per day', () => {
  const result = plan({ schools: [school('escola'), school('escola-2')],
    selectedSchoolIds: ['escola', 'escola-2'] });
  assert.equal(result.plans.length, 2);
  assert.notEqual(result.plans[0].slots[0].examinerId, result.plans[1].slots[0].examinerId);
});

test('reserves a scarce examiner for the school that cannot use anyone else', () => {
  const result = plan({
    schools: [school('A', { name: 'A', city: 'CIDADE A' }),
      school('B', { name: 'B', city: 'CIDADE B' })],
    selectedSchoolIds: ['A', 'B'],
    examiners: [examiner('ex-1', ['cidade-a', 'cidade-b']), examiner('ex-2', ['cidade-a'])],
  });
  assert.equal(result.plans.length, 2);
  assert.equal(result.plans.find(p => p.school.id === 'B').slots[0].examinerId, 'ex-1');
  assert.equal(result.plans.find(p => p.school.id === 'A').slots[0].examinerId, 'ex-2');
});

test('reserves selected legacy fixed-scale commitments before rotating examiners', () => {
  const result = plan({
    schools: [
      school('escola'),
      school('fixa', { examRotation: false, mainSchedule: { active: true,
        frequency: '1_WEEK', days: ['SEG'], slots: [{ time: '08:00', examiner: 'ex-a' }] } }),
    ],
    selectedSchoolIds: ['escola', 'fixa'],
  });
  assert.equal(result.plans.find(p => p.school.id === 'escola').slots[0].examinerId, 'ex-b');
});