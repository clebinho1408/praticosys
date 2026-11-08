import assert from 'node:assert/strict';
import { cnhBancaConflict, cnhSchoolScaleConflict } from '../../functions/_cnh-time-conflicts.js';

const main = (time = '08:00', day = 'SEG', examiner = 'examiner-a') => ({
  active: true, frequency: '1_WEEK', days: [day], slots: [{ time, examiner }],
});
const prov = (date = '2035-01-08', time = '08:00') => ({
  active: true, frequency: '1_WEEK', days: [], slots: [],
  specificDates: [{ id: 'entry', date, time, examiner: 'examiner-b' }],
});

export function testCnhTimePolicy() {
  const banca = { id: 'a', type: 'COMMON', date: '2035-01-08', time: '08:00', status: 'OPEN' };
  assert.ok(cnhBancaConflict({ ...banca, id: 'b' }, [banca]));
  assert.equal(cnhBancaConflict(banca, [banca]), null);
  assert.equal(cnhBancaConflict({ ...banca, id: 'b', time: '09:00' }, [banca]), null);
  assert.equal(cnhBancaConflict({ ...banca, id: 'b' }, [{ ...banca, status: 'CANCELLED' }]), null);
  assert.equal(cnhBancaConflict({ ...banca, id: 'b', type: 'PCD' }, [banca]), null);
  assert.ok(cnhBancaConflict({ ...banca, id: 'b', date: '2035-01-08T00:00:00Z', time: '08:00:00' }, [banca]));
  const school = { id: 'a', name: 'Escola A', cnhBrasilProfile: true, mainSchedule: main() };
  const other = { id: 'b', name: 'Escola B', cnhBrasilProfile: true, mainSchedule: main('08:00', 'SEG', 'examiner-b') };
  const today = '2035-01-01';
  assert.ok(cnhSchoolScaleConflict(school, [other], today));
  assert.equal(cnhSchoolScaleConflict(school, [school], today), null);
  assert.equal(cnhSchoolScaleConflict({ ...school, cnhBrasilProfile: false }, [other], today), null);
  assert.equal(cnhSchoolScaleConflict(school, [{ ...other, cnhBrasilProfile: false }], today), null);
  assert.equal(cnhSchoolScaleConflict(school, [{ ...other, mainSchedule: main('09:00') }], today), null);
  assert.equal(cnhSchoolScaleConflict(school, [{ ...other, mainSchedule: main('08:00', 'TER') }], today), null);
  assert.ok(cnhSchoolScaleConflict(school, [{ ...other, mainSchedule: null, provisionalSchedule: prov() }], today));
  assert.ok(cnhSchoolScaleConflict({ ...school, mainSchedule: null, provisionalSchedule: prov() }, [other], today));
  assert.equal(cnhSchoolScaleConflict(school, [{ ...other, mainSchedule: null, provisionalSchedule: prov('2034-01-02') }], today), null);
  assert.equal(cnhSchoolScaleConflict({ ...school, mainSchedule: { ...main(), pausedDates: ['2035-01-08'] } },
    [{ ...other, mainSchedule: null, provisionalSchedule: prov() }], today), null);
  const duplicate = { ...school, mainSchedule: { ...main(), slots: [{ time: '08:00', examiner: 'a' }, { time: '08:00', examiner: 'b' }] } };
  assert.ok(cnhSchoolScaleConflict(duplicate, [], today));
  assert.ok(cnhSchoolScaleConflict({ ...school, mainSchedule: null, provisionalSchedule: {
    ...prov(), specificDates: [...prov().specificDates, { ...prov().specificDates[0], id: 'second' }],
  } }, [], today));
  // Main and provisional of one school are mutually exclusive replacement configurations.
  assert.equal(cnhSchoolScaleConflict({ ...school, provisionalSchedule: prov() }, [], today), null);
  assert.ok(cnhSchoolScaleConflict({ ...school, mainSchedule: { ...main(), active: false } }, [other], today));
}

export async function testCnhConflictApi(
  api: (route: string, method: string, body?: any) => Promise<{ status: number; body: any }>,
) {
  const ok = (response: { status: number; body: any }) => assert.equal(response.status, 200, JSON.stringify(response.body));
  let result = await api('schools', 'POST', { id: 'cnh-a', name: 'CNH A', cnhBrasilProfile: true, mainSchedule: main() });
  ok(result);
  const schoolId = result.body.id;
  result = await api('schools', 'POST', { name: 'CNH B', cnhBrasilProfile: true, mainSchedule: main('08:00', 'SEG', 'examiner-b') });
  assert.equal(result.status, 409);
  assert.match(result.body.error, /CNH A/);
  result = await api('schools', 'POST', { name: 'CFC allowed', cnhBrasilProfile: false, mainSchedule: main() });
  ok(result);
  const cfcId = result.body.id;
  result = await api('schools', 'PUT', { id: cfcId, cnhBrasilProfile: true });
  assert.equal(result.status, 409, 'Enabling CNH profile must validate merged existing scale');
  result = await api('schools', 'POST', { name: 'CNH B', cnhBrasilProfile: true, mainSchedule: main('09:00') });
  ok(result);
  const otherId = result.body.id;
  result = await api('schools', 'PUT', { id: otherId, mainSchedule: main('08:00') });
  assert.equal(result.status, 409);
  result = await api('schools', 'PUT', { id: otherId, mainSchedule: null, provisionalSchedule: prov() });
  assert.equal(result.status, 409, 'Provisional concrete date conflicts with principal weekday');
  result = await api('schools', 'PUT', { id: otherId, mainSchedule: null, provisionalSchedule: prov('2035-01-09') });
  ok(result);
  result = await api('schools', 'POST', { name: 'CNH C', cnhBrasilProfile: true, provisionalSchedule: prov('2035-01-09') });
  assert.equal(result.status, 409);
  result = await api('schools', 'PUT', { id: otherId, name: 'CNH B renamed' });
  ok(result);
  const base = { date: '2035-01-08', time: '08:00', type: 'COMMON', examinerIds: ['examiner-a'],
    maxSlotsA: 10, maxSlotsB: 10, sourceSchoolId: schoolId };
  result = await api('schedules', 'POST', base);
  ok(result);
  const bancaId = result.body.id;
  result = await api('schedules', 'POST', { ...base, examinerIds: ['examiner-b'] });
  assert.equal(result.status, 409);
  assert.match(result.body.error, /mesmo que o examinador/);
  result = await api('schedules', 'POST', { ...base, time: '09:00' });
  ok(result);
  const otherBancaId = result.body.id;
  result = await api('schedules', 'PUT', { id: otherBancaId, time: '08:00', examinerIds: ['examiner-b'] });
  assert.equal(result.status, 409);
  result = await api('schedules', 'PUT', { id: bancaId, examinerIds: ['examiner-b'] });
  ok(result);
  result = await api('schedules', 'POST', { ...base, type: 'PCD' });
  ok(result);
  result = await api('schools', 'GET');
  ok(result);
  assert.equal(result.body.find((school: any) => school.id === cfcId).cnhBrasilProfile, false);
  assert.equal(result.body.find((school: any) => school.id === otherId).provisionalSchedule.specificDates[0].date, '2035-01-09');
  result = await api('schedules', 'GET');
  ok(result);
  assert.equal(result.body.find((item: any) => item.id === otherBancaId).time, '09:00', 'Rejected edit must leave original untouched');
  assert.equal(result.body.filter((item: any) => item.type === 'COMMON').length, 2, 'Rejected creation must not insert');
}
