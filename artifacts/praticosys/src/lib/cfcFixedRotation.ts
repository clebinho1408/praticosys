import type { City, DrivingSchool, Examiner, SchoolSchedule } from '../types';

export type FixedCommitment = {
  id?: string;
  schoolId?: string | null;
  examinerId?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  requestType?: string | null;
  status?: string | null;
};

export type FixedScaleSlot = { examinerId: string; scheduledTime: string };
export type FixedSchoolPlan = { school: DrivingSchool; slots: FixedScaleSlot[] };
export type FixedScaleIssue = { school: DrivingSchool; reason: string };

const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const validTime = (value?: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value ?? '');
const activeCommitment = (item: FixedCommitment) => item.status !== 'CANCELLED';

export function fixedScaleDay(date: string): string {
  return weekdays[new Date(`${date}T00:00:00`).getDay()];
}

export function activeSchoolSchedule(school: DrivingSchool): SchoolSchedule | null {
  return school.provisionalSchedule?.active
    ? school.provisionalSchedule
    : school.mainSchedule?.active ? school.mainSchedule : null;
}

export function rotationCandidates(
  school: DrivingSchool,
  day: string,
  examiners: Examiner[],
  cities: City[],
): { eligible: Examiner[]; reason?: string } {
  if (!school.examRotation) {
    return { eligible: [], reason: 'Rodízio de Provas desativado para esta autoescola.' };
  }
  // Autoescolas guardam o nome da cidade; a disponibilidade guarda IDs.
  const city = cities.find(item => item.name.trim() === school.city?.trim());
  if (!city) return { eligible: [], reason: 'Cidade da autoescola não cadastrada ou não informada.' };

  const eligible = examiners.filter(examiner => {
    const availability = examiner.rotationAvailability;
    return examiner.examRotation && examiner.canExamCommon !== false &&
      availability?.days?.includes(day) &&
      availability.cityIds?.includes(city.id) &&
      validTime(availability.defaultTime) &&
      (availability.examsPerDay === 1 ||
        (availability.examsPerDay === 2 && validTime(availability.secondDefaultTime) &&
          availability.secondDefaultTime !== availability.defaultTime));
  });
  return eligible.length
    ? { eligible }
    : { eligible: [], reason: 'Nenhum examinador com rodízio, dia, cidade e horários compatíveis.' };
}

export function planFixedScales(input: {
  date: string;
  selectedSchoolIds: string[];
  schools: DrivingSchool[];
  examiners: Examiner[];
  cities: City[];
  commitments: FixedCommitment[];
}): { plans: FixedSchoolPlan[]; issues: FixedScaleIssue[] } {
  const { date, schools, examiners, cities } = input;
  const day = fixedScaleDay(date);
  const selected = new Set(input.selectedSchoolIds);
  const commitments = input.commitments.filter(activeCommitment);
  const plans: FixedSchoolPlan[] = [];
  const issues: FixedScaleIssue[] = [];
  const reserved: FixedCommitment[] = [];

  // Reservar primeiro os examinadores das escolas com menos opções de atendimento.
  for (const school of schools.filter(s => selected.has(s.id) && s.id !== 'PCD' && s.id !== 'CNH_BRASIL')
    .sort((a, b) => {
      const options = (item: DrivingSchool) => item.examRotation
        ? rotationCandidates(item, day, examiners, cities).eligible.length
        : -1; // Escalas fixas sem rodízio reservam seus horários antes da distribuição.
      return options(a) - options(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    })) {
    const schedule = activeSchoolSchedule(school);
    if (!schedule?.days?.includes(day)) {
      issues.push({ school, reason: 'Sem escala ativa para o dia selecionado.' });
      continue;
    }

    const matchingSlots = (schedule.slots ?? []).filter(slot => !slot.day || slot.day === day);
    if (!matchingSlots.length) {
      issues.push({ school, reason: 'A escala ativa não tem provas configuradas para este dia.' });
      continue;
    }
    if (commitments.some(item => item.schoolId === school.id &&
      item.scheduledDate === date && item.requestType === 'FIXA')) {
      issues.push({ school, reason: 'Já existe escala fixa para esta data; nenhuma prova foi duplicada.' });
      continue;
    }

    if (!school.examRotation) {
      const slots = matchingSlots.map(slot => ({
        examinerId: slot.examiner,
        scheduledTime: slot.time,
      }));
      if (new Set(slots.map(slot => slot.scheduledTime)).size !== slots.length) {
        issues.push({ school, reason: 'A escala ativa contém horários repetidos.' });
        continue;
      }
      plans.push({ school, slots });
      reserved.push(...slots.map(slot => ({ ...slot, schoolId: school.id, scheduledDate: date })));
      continue;
    }

    const { eligible, reason } = rotationCandidates(school, day, examiners, cities);
    if (reason) {
      issues.push({ school, reason });
      continue;
    }

    const allocated: FixedScaleSlot[] = [];
    const tentative: FixedCommitment[] = [];
    for (const _slot of matchingSlots) {
      const choices = eligible.flatMap(examiner => {
        const availability = examiner.rotationAvailability!;
        const times = availability.examsPerDay === 2
          ? [availability.defaultTime, availability.secondDefaultTime!]
          : [availability.defaultTime];
        const appointments = [...commitments, ...reserved, ...tentative]
          .filter(item => item.examinerId === examiner.id && item.scheduledDate === date);
        // Candidatos e vagas podem representar a mesma prova. Contar a prova uma vez só.
        const occupied = new Set(appointments.map(item =>
          `${item.schoolId ?? ''}|${item.scheduledTime ?? item.id ?? ''}`));
        if (occupied.size >= availability.examsPerDay) return [];
        return times.flatMap((time, order) =>
          !appointments.some(item => item.scheduledTime === time) &&
          ![...reserved, ...tentative].some(item =>
            item.schoolId === school.id && item.scheduledTime === time)
            ? [{ examiner, time, order, dailyLoad: occupied.size }]
            : []);
      });

      choices.sort((a, b) => {
        const history = (examinerId: string) => commitments.filter(item =>
          item.schoolId === school.id && item.examinerId === examinerId &&
          item.requestType === 'FIXA' && !!item.scheduledDate && item.scheduledDate < date);
        const distinctHistory = (examinerId: string) => {
          const unique = new Map<string, FixedCommitment>();
          for (const item of history(examinerId)) {
            unique.set(`${item.scheduledDate}|${item.scheduledTime}`, item);
          }
          return [...unique.values()];
        };
        const aHistory = distinctHistory(a.examiner.id);
        const bHistory = distinctHistory(b.examiner.id);
        const aSameDay = tentative.some(item => item.examinerId === a.examiner.id);
        const bSameDay = tentative.some(item => item.examinerId === b.examiner.id);
        return Number(bSameDay) - Number(aSameDay) ||
          aHistory.length - bHistory.length ||
          (aHistory.map(item => item.scheduledDate!).sort().at(-1) ?? '').localeCompare(
            bHistory.map(item => item.scheduledDate!).sort().at(-1) ?? '') ||
          a.dailyLoad - b.dailyLoad ||
          a.examiner.id.localeCompare(b.examiner.id) ||
          a.order - b.order;
      });

      const chosen = choices[0];
      if (!chosen) break;
      allocated.push({ examinerId: chosen.examiner.id, scheduledTime: chosen.time });
      tentative.push({ schoolId: school.id, examinerId: chosen.examiner.id,
        scheduledDate: date, scheduledTime: chosen.time });
    }
    if (allocated.length !== matchingSlots.length) {
      issues.push({ school, reason: 'Examinadores sem capacidade ou horários livres para todas as provas do dia.' });
      continue;
    }
    plans.push({ school, slots: allocated });
    reserved.push(...tentative);
  }
  return { plans, issues };
}