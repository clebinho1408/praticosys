/** Calendar dates, not instants: a pause never changes the schedule's active flag. */
export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function mainSchedulePaused(school: {
  provisionalSchedule?: { active?: boolean } | null;
  mainSchedule?: { pausedDates?: string[] } | null;
}, date: string): boolean {
  return !school.provisionalSchedule?.active &&
    !!school.mainSchedule?.pausedDates?.includes(date);
}

export function schoolPauseValidation(body: any): string | null {
  const dates = body?.mainSchedule?.pausedDates;
  if (dates === undefined) return null;
  if (!Array.isArray(dates) || dates.some(date => !isCalendarDate(date)) ||
      new Set(dates).size !== dates.length) {
    return 'Informe datas válidas e sem repetição para pausar a Escala Principal.';
  }
  return null;
}

export function visibleProvisionalDates<T extends { date: string }>(dates: T[], today: string): T[] {
  return dates.filter(entry => !entry.date || entry.date >= today);
}
