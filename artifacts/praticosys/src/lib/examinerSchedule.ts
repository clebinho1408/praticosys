/** Includes today through the date seven days ahead, across calendar weeks/months. */
export function examinerDateInRange(date: string | null | undefined, filter: 'DAY' | 'TOMORROW' | 'WEEK', now = new Date()) {
  if (!date) return false;
  const localDate = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const today = localDate(now);
  const end = new Date(now);
  end.setDate(end.getDate() + (filter === 'WEEK' ? 7 : 1));
  if (filter === 'DAY') return date === today;
  if (filter === 'TOMORROW') return date === localDate(end);
  return date >= today && date <= localDate(end);
}

export function compareExaminerSchedule(
  a: { scheduledDate?: string | null; scheduledTime?: string | null },
  b: { scheduledDate?: string | null; scheduledTime?: string | null },
) {
  const time = (value?: string | null) => (value || '08:00').split(':').map(Number).reduce((hours, part, i) => hours + part * (i === 0 ? 3600 : i === 1 ? 60 : 1), 0);
  return (a.scheduledDate || '').localeCompare(b.scheduledDate || '') || time(a.scheduledTime) - time(b.scheduledTime);
}
