import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore shared frontend pure helper
import { examinerDateInRange, compareExaminerSchedule } from '../../artifacts/praticosys/src/lib/examinerSchedule';

test('week includes today and next seven days, not calendar-week boundaries', () => {
  const now = new Date(2026, 10, 12, 15);
  for (const day of ['2026-11-12', '2026-11-15', '2026-11-19'])
    assert.equal(examinerDateInRange(day, 'WEEK', now), true);
  for (const day of ['2026-11-11', '2026-11-20', undefined])
    assert.equal(examinerDateInRange(day, 'WEEK', now), false);
  assert.equal(examinerDateInRange('2027-01-04', 'WEEK', new Date(2026, 11, 28)), true);
  assert.equal(examinerDateInRange('2026-11-12', 'DAY', now), true);
  assert.equal(examinerDateInRange('2026-11-13', 'TOMORROW', now), true);
  assert.equal(examinerDateInRange('2026-11-14', 'TOMORROW', now), false);
});

test('confirmed exams sort by ascending date then time', () => {
  const rows = [
    { scheduledDate: '2026-11-14', scheduledTime: '07:00' },
    { scheduledDate: '2026-11-13', scheduledTime: '10:00' },
    { scheduledDate: '2026-11-13', scheduledTime: '8:30' },
    { scheduledDate: '2026-11-13', scheduledTime: '08:00' },
  ];
  assert.deepEqual([...rows].sort(compareExaminerSchedule), [rows[3], rows[2], rows[1], rows[0]]);
});
