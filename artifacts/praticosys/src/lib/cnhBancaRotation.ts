import type { City, DrivingSchool, Examiner, ExamSchedule } from '../types';
import { fixedScaleDay, rotationCandidates } from './cfcFixedRotation.ts';

export type CnhBancaSuggestion = { examinerId: string; time: string };
export type CnhBancaCommitment = {
  examinerId?: string | null;
  scheduledTime?: string | null;
  schoolId?: string | null;
  status?: string | null;
};

export function cnhBancaSuggestions(
  school: DrivingSchool,
  date: string,
  examiners: Examiner[],
  cities: City[],
  schedules: ExamSchedule[],
  commitments: CnhBancaCommitment[] = [],
): { options: CnhBancaSuggestion[]; reason?: string } {
  if (!school.cnhBrasilProfile) {
    return { options: [], reason: 'Perfil CNH do Brasil desativado para esta autoescola.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    return { options: [], reason: 'Selecione uma data válida.' };
  }
  const { eligible, reason } = rotationCandidates(school, fixedScaleDay(date), examiners, cities);
  if (reason) return { options: [], reason };

  const active = schedules.filter(s => s.status !== 'CANCELLED');
  const options = eligible.flatMap(examiner => {
    const availability = examiner.rotationAvailability!;
    const times = availability.examsPerDay === 2
      ? [availability.defaultTime, availability.secondDefaultTime!]
      : [availability.defaultTime];
    const booked = active.filter(s => s.date === date && s.examinerIds?.includes(examiner.id));
    const other = commitments.filter(item => item.examinerId === examiner.id && item.status !== 'CANCELLED');
    const occupied = new Set([
      ...booked.map(s => `banca:${s.id ?? `${s.date}:${s.time}`}`),
      ...other.map(item => `escala:${item.schoolId ?? ''}:${item.scheduledTime ?? ''}`),
    ]);
    if (occupied.size >= availability.examsPerDay) return [];
    return times.filter(time => !booked.some(s => s.time === time) &&
        !other.some(item => item.scheduledTime === time))
      .map(time => ({ examinerId: examiner.id, time }));
  });
  const history = (id: string) => active.filter(s =>
    s.date < date && s.examinerIds?.includes(id));
  options.sort((a, b) => {
    const ah = history(a.examinerId);
    const bh = history(b.examinerId);
    return ah.length - bh.length ||
      (ah.map(s => s.date).sort().at(-1) ?? '').localeCompare(bh.map(s => s.date).sort().at(-1) ?? '') ||
      a.time.localeCompare(b.time) || a.examinerId.localeCompare(b.examinerId);
  });
  return options.length
    ? { options }
    : { options: [], reason: 'Nenhum examinador do rodízio com horário livre para esta data.' };
}