import assert from 'node:assert/strict';
import { localD1 } from './d1-runtime.js';
import { businessDate, isCalendarDate, mainSchedulePaused, schoolPauseValidation, visibleProvisionalDates } from '../../functions/_school-schedule.js';
import { planFixedScales } from '../../artifacts/praticosys/src/lib/cfcFixedRotation.js';
import { canPauseScheduleOn } from '../../artifacts/praticosys/src/lib/dateBlocking.js';
import { cfcScheduleSlots } from '../../db/schema.js';

const { onRequest: schools } = await import(new URL('../../functions/api/schools.ts', import.meta.url).href);
const { onRequest: slots } = await import(new URL('../../functions/api/schedule-slots.ts', import.meta.url).href);

assert.equal(businessDate(new Date('2026-11-02T02:59:59Z')), '2026-11-01');
assert.equal(businessDate(new Date('2026-11-02T03:00:00Z')), '2026-11-02');
assert.equal(isCalendarDate('2026-02-30'), false);
assert.equal(isCalendarDate('2028-02-29'), true);
const holidays = [{ id: 'synthetic-holiday', date: '2026-11-02', description: 'Feriado de teste', isHoliday: true }];
assert.equal(canPauseScheduleOn('2026-10-26', '2026-11-01', ['SEG'], [], null), false, 'Past fixed weekday');
assert.equal(canPauseScheduleOn('2026-11-02', '2026-11-01', ['SEG'], holidays, null), false, 'Holiday on fixed weekday');
assert.equal(canPauseScheduleOn('2026-11-03', '2026-11-01', ['SEG'], [], null), false, 'Unconfigured weekday');
assert.equal(canPauseScheduleOn('2026-11-03', '2026-11-03', ['TER'], [], null), true, 'Today is allowed on configured weekday');
assert.equal(canPauseScheduleOn('2026-11-09', '2026-11-01', ['SEG'], holidays, null), true, 'Future fixed weekday');
assert.equal(canPauseScheduleOn('2026-11-09', '2026-11-01', [], [], null), false, 'No days configured');
assert.equal(canPauseScheduleOn('2026-02-30', '2026-01-01', ['SEG'], [], null), false, 'Invalid calendar date');
assert.equal(canPauseScheduleOn('2026-11-03', '2026-11-01', ['TER'], [
  { id: 'blocked', date: '2026-11-03T00:00:00Z', description: 'Data bloqueada', isHoliday: false },
], null), false, 'Blocked dates are respected even before settings load');
for (const pausedDates of [null, '2026-11-02', ['invalid'], ['2026-02-30'], ['2026-11-02', '2026-11-02']]) {
  assert.ok(schoolPauseValidation({ mainSchedule: { pausedDates } }));
}
assert.equal(schoolPauseValidation({ mainSchedule: { pausedDates: [] } }), null);
const dates = [{ date: '2026-11-01' }, { date: '2026-11-02' }, { date: '' }, { date: '2026-11-03' }];
assert.deepEqual(visibleProvisionalDates(dates, '2026-11-02'), dates.slice(1));
assert.equal(dates.length, 4, 'Filtering must not mutate historical configuration');

const schedule = { active: true, frequency: '1_WEEK', days: ['SEG', 'TER'],
  slots: [{ time: '08:00', examiner: 'synthetic-examiner' }], pausedDates: ['2026-11-02'] };
const school: any = { id: 'pause-school', name: 'Autoescola fictícia', mainSchedule: schedule };
const plan = (item: any, date: string) => planFixedScales({
  date, schools: [item], selectedSchoolIds: [item.id], examiners: [], cities: [], commitments: [],
});
for (const frequency of ['1_WEEK', '15_DAYS']) {
  for (const examRotation of [false, true]) {
    const item = { ...school, examRotation, mainSchedule: { ...schedule, frequency } };
    assert.equal(plan(item, '2026-11-02').plans.length, 0);
    assert.match(plan(item, '2026-11-02').issues[0].reason, /pausada/);
  }
}
assert.equal(plan(school, '2026-11-03').plans.length, 1);
assert.equal(plan({ ...school, mainSchedule: { ...schedule, active: false } }, '2026-11-03').plans.length, 0);
assert.equal(mainSchedulePaused({ ...school, provisionalSchedule: { active: true } }, '2026-11-02'), false);
assert.equal(plan({ ...school, provisionalSchedule: { active: true, specificDates: [
  { date: '2026-11-02', time: '09:00', examiner: 'synthetic-examiner' },
] } }, '2026-11-02').plans.length, 1);

const runtime = await localD1();
try {
  const call = (handler: any, method: string, body?: any, role = 'ADMIN') => handler({
    request: new Request('http://test.invalid/api/test', {
      method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    }), env: runtime.env, data: { sessionUserRole: role },
  });
  let response = await call(schools, 'POST', school);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as any).mainSchedule.pausedDates, ['2026-11-02']);
  response = await call(schools, 'GET');
  assert.deepEqual((await response.json() as any[])[0].mainSchedule.pausedDates, ['2026-11-02']);
  await runtime.db.insert(cfcScheduleSlots).values({
    id: 'preserved-confirmed', schoolId: school.id, scheduledDate: '2026-11-02',
    scheduledTime: '07:00', examinerId: 'synthetic-examiner',
    examType: 'COMMON', requestType: 'FIXA', status: 'SCHEDULED', attendanceConfirmed: true,
  });
  const before = await runtime.db.select().from(cfcScheduleSlots);
  const automatic = (date: string) => ({
    automaticFixed: { schoolId: school.id, date, slots: [{ examinerId: 'synthetic-examiner', scheduledTime: '08:00' }] },
  });
  response = await call(slots, 'POST', automatic('2026-11-02'));
  assert.equal(response.status, 409);
  assert.match((await response.json() as any).error, /pausada/);
  assert.deepEqual(await runtime.db.select().from(cfcScheduleSlots), before);
  response = await call(slots, 'POST', automatic('2026-11-03'));
  assert.equal(response.status, 200, 'Next configured date resumes without updating the active flag');
  response = await call(schools, 'PUT', { id: school.id, mainSchedule: { ...schedule, pausedDates: ['2026-02-30'] } });
  assert.equal(response.status, 400);
  response = await call(schools, 'PUT', { id: school.id, mainSchedule: { ...schedule, pausedDates: [] } }, 'OPERATOR');
  assert.equal(response.status, 403);
  response = await call(schools, 'PUT', { id: school.id, mainSchedule: { ...schedule, pausedDates: [] } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json() as any).mainSchedule.pausedDates, []);
  response = await call(schools, 'GET');
  assert.equal((await response.json() as any[])[0].mainSchedule.active, true);
  console.log('Escalas: fuso, filtro não destrutivo, pausas, retomada, rodízio, permissões e persistência Pages/D1 verificados.');
} finally { await runtime.mf.dispose(); }
