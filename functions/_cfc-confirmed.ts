// Shared policy for Express and Cloudflare. Decisions use the stored row, not
// module/status/role supplied by the browser.
export const confirmedFields = [
  'scheduledDate', 'scheduledTime', 'examinerId', 'intendedCategory', 'categoryQuantities', 'requestType',
] as const;

export function canManageConfirmed(role: unknown) {
  return role === 'ADMIN' || role === 'SUPERVISOR';
}

export function isConfirmedCfc(row: any, module: string, slot = false) {
  // PCD/CNH scale placeholders are also displayed in the CFC confirmed card.
  return !!row && (slot || module === 'CFC') &&
    row.status === 'SCHEDULED' && row.attendanceConfirmed === true;
}

export function confirmedAccessError(row: any, module: string, slot: boolean, role: unknown, updates: any) {
  const confirmed = isConfirmedCfc(row, module, slot);
  if (updates.confirmedEdit && !confirmed) return 'O agendamento não está mais confirmado. Atualize a lista.';
  if (confirmed && !canManageConfirmed(role)) {
    const protectedFields = [...confirmedFields, 'schoolId', 'examType', 'modulo', 'scheduleId'];
    const changed = protectedFields.some(k => updates[k] !== undefined &&
      JSON.stringify(updates[k]) !== JSON.stringify(row[k]));
    // Existing cancellation and automatic DONE transitions remain unchanged.
    const unconfirm = updates.attendanceConfirmed === false && updates.status !== 'CANCELLED';
    if (updates.confirmedEdit || changed || unconfirm) {
      return 'Somente administradores e supervisores podem editar provas confirmadas.';
    }
  }
  return null;
}

export function confirmedPatch(body: any) {
  const patch: any = {};
  for (const key of confirmedFields) if (body[key] !== undefined) patch[key] = body[key];
  return patch;
}

export function validateConfirmedFields(row: any, updates: any, today: string) {
  const merged = { ...row, ...confirmedPatch(updates) };
  const date = merged.scheduledDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T12:00:00Z`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return 'Informe uma data válida.';
  if (date < today) return 'Não é permitido reagendar para uma data passada.';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(merged.scheduledTime ?? '')) return 'Informe um horário válido.';
  if (typeof merged.examinerId !== 'string' || !merged.examinerId) return 'Selecione o examinador.';
  if (!['FIXA', 'EXTRA', 'REPOSICAO'].includes(merged.requestType)) return 'Selecione um tipo de agendamento válido.';
  const cats = typeof merged.intendedCategory === 'string' ? merged.intendedCategory.split(',') : [];
  const allowed = row.examType === 'PCD' || row.schoolId === 'PCD' ? ['PCD'] : ['A', 'B', 'C', 'D', 'E'];
  if (!cats.length || cats.some((c: string) => !allowed.includes(c)) || new Set(cats).size !== cats.length) {
    return 'Selecione categorias válidas.';
  }
  const hasHab = cats.some((c: string) => ['A', 'B'].includes(c));
  const hasMudanca = cats.some((c: string) => ['C', 'D', 'E'].includes(c));
  const group = cats.includes('PCD') ? 'PCD' : hasHab && hasMudanca ? 'MISTO' : hasMudanca ? 'MUD_CAT' : '1HAB';
  if (updates.examGroup !== undefined && updates.examGroup !== group) {
    return 'As categorias selecionadas não correspondem ao exame informado.';
  }
  const quantities = merged.categoryQuantities;
  // Legacy records may have no quantities yet. A confirmed editor always sends
  // explicit quantities, whereas older callers can change a date alone.
  if (updates.confirmedEdit || updates.categoryQuantities !== undefined) {
    if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities) ||
      Object.keys(quantities).some(c => !cats.includes(c)) ||
      cats.some((c: string) => !Number.isSafeInteger(quantities[c]) || quantities[c] < 0)) {
      return 'Informe vagas inteiras, não negativas, para cada categoria selecionada.';
    }
  }
  return null;
}

export function todayInBrazil() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function validateConfirmedEdit(db: any, tables: any, row: any, updates: any) {
  const invalid = validateConfirmedFields(row, updates, todayInBrazil());
  if (invalid) return invalid;
  const merged = { ...row, ...confirmedPatch(updates) };
  const [examiners, settings, blocked] = await Promise.all([
    db.select().from(tables.examiners),
    db.select().from(tables.systemSettings),
    db.select().from(tables.blockedDates),
  ]);
  const examiner = examiners.find((ex: any) => ex.id === merged.examinerId);
  if (!examiner) return 'Examinador não encontrado.';
  const cats = merged.intendedCategory.split(',');
  if (cats.includes('PCD') ? !examiner.canExamPCD :
    examiner.categories?.length && !cats.some((c: string) => examiner.categories.includes(c))) {
    return 'O examinador não atende às categorias selecionadas.';
  }
  const weekday = new Date(`${merged.scheduledDate}T12:00:00Z`).getUTCDay();
  if (blocked.some((b: any) => b.date?.split('T')[0] === merged.scheduledDate) ||
    (settings[0]?.blockWeekends && [0, 6].includes(weekday))) return 'Esta data está bloqueada para agendamento.';
  return null;
}

export function hasCandidateIdentity(row: any) {
  return !!(row.cpf || row.studentName || row.socialName);
}

// Removing an appointment for a real candidate must not delete that candidate.
export const clearAppointment = {
  status: 'WAITING_SCHEDULING', scheduleId: null, scheduledDate: null,
  scheduledTime: null, scheduledCategory: null, examinerId: null,
  attendanceConfirmed: false, queueUpdatedAt: null,
};
