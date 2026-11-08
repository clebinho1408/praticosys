import { businessDate, isCalendarDate } from './_school-schedule.js';

type Banca = {
  id?: string; code?: string | null; type?: string | null; status?: string | null;
  date?: string | null; time?: string | null;
};
type Scale = {
  active?: boolean;
  days?: string[];
  slots?: { day?: string; time?: string }[];
  specificDates?: { date?: string; time?: string }[];
  pausedDates?: string[];
};
type School = {
  id?: string; name?: string | null; cnhBrasilProfile?: boolean | null;
  mainSchedule?: Scale | null; provisionalSchedule?: Scale | null;
};
type Entry = { day: string; time: string; date?: string };
const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const dateOnly = (date?: string | null) => date?.split('T')[0] || '';
const timeOnly = (time?: string | null) => time?.trim().slice(0, 5) || '';
const dateBR = (date: string) => date.split('-').reverse().join('/');

/** CNH bancas are shared: neither examiner nor location makes the time unique. */
export function cnhBancaConflict(candidate: Banca, existing: Banca[]): string | null {
  if (candidate.type !== 'COMMON' || candidate.status === 'CANCELLED') return null;
  const date = dateOnly(candidate.date);
  const time = timeOnly(candidate.time);
  if (!date || !time) return null;
  const other = existing.find(item => item.id !== candidate.id && item.type === 'COMMON' &&
    item.status !== 'CANCELLED' && dateOnly(item.date) === date && timeOnly(item.time) === time);
  return other ? `Já existe uma banca CNH do Brasil${other.code ? ` (${other.code})` : ''} em ${dateBR(date)} às ${time}. Escolha outra data ou horário, mesmo que o examinador seja diferente.` : null;
}

function mainEntries(schedule?: Scale | null): Entry[] {
  return (schedule?.slots || []).flatMap(slot =>
    (slot.day ? [slot.day].filter(day => schedule?.days?.includes(day)) : schedule?.days || [])
      .filter(day => days.includes(day) && timeOnly(slot.time))
      .map(day => ({ day, time: timeOnly(slot.time) })));
}

function provisionalEntries(schedule: Scale | null | undefined, today: string): Entry[] {
  return (schedule?.specificDates || []).flatMap(entry => {
    const date = dateOnly(entry.date);
    return isCalendarDate(date) && date >= today && timeOnly(entry.time)
      ? [{ date, time: timeOnly(entry.time), day: days[new Date(`${date}T12:00:00Z`).getUTCDay()] }] : [];
  });
}

function overlap(a: Entry, b: Entry, aMain?: Scale | null, bMain?: Scale | null): boolean {
  if (a.time !== b.time || a.day !== b.day) return false;
  if (a.date && b.date) return a.date === b.date;
  if (a.date) return !bMain?.pausedDates?.includes(a.date);
  if (b.date) return !aMain?.pausedDates?.includes(b.date);
  return true;
}

function when(entry: Entry): string {
  return entry.date ? `${dateBR(entry.date)} às ${entry.time}` : `${entry.day} às ${entry.time}`;
}

/**
 * Compare configured CNH school scales, including inactive configurations.
 * Main/provisional of the SAME school are alternatives, not simultaneous exams.
 * Pauses excuse concrete dates, not an indefinitely recurring weekly conflict.
 */
export function cnhSchoolScaleConflict(candidate: School, existing: School[], today = businessDate()): string | null {
  if (!candidate.cnhBrasilProfile) return null;
  const main = mainEntries(candidate.mainSchedule);
  const prov = provisionalEntries(candidate.provisionalSchedule, today);
  for (const [entries, label] of [[main, 'Principal'], [prov, 'Provisória']] as const) {
    const repeated = entries.find((entry, index) =>
      entries.slice(0, index).some(other => overlap(entry, other)));
    if (repeated) return `A Escala ${label} contém horários repetidos: ${when(repeated)}. Não é permitido usar o mesmo dia e horário, mesmo com examinadores diferentes.`;
  }
  for (const other of existing) {
    if (!other.cnhBrasilProfile || other.id === candidate.id) continue;
    const otherMain = mainEntries(other.mainSchedule);
    const otherProv = provisionalEntries(other.provisionalSchedule, today);
    for (const [ownEntries, otherEntries, ownMain, comparedMain] of [
      [main, otherMain, candidate.mainSchedule, other.mainSchedule],
      [main, otherProv, candidate.mainSchedule, null],
      [prov, otherMain, null, other.mainSchedule],
      [prov, otherProv, null, null],
    ] as const) {
      const conflict = ownEntries.find(a => otherEntries.some(b => overlap(a, b, ownMain, comparedMain)));
      if (conflict) return `Conflito de horário com a autoescola "${other.name || 'sem nome'}", com Perfil CNH do Brasil: ${when(conflict)}. Escolha outro dia ou horário, mesmo que o examinador seja diferente.`;
    }
  }
  return null;
}
