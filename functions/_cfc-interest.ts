/**
 * "Tenho interesse": examinador registra interesse em um pedido de prova extra
 * (módulo CFC, status WAITING_SCHEDULING). Regras compartilhadas entre
 * Cloudflare Functions e Express. Decisões usam a linha armazenada e a
 * identidade da sessão — nunca o examinerId enviado pelo navegador.
 */
export interface InterestedExaminer {
  examinerId: string;
  name: string;
  registeredAt: string;
}

export function canRegisterInterest(role: string | undefined): boolean {
  return role === 'EXAMINER';
}

/** Pedido ainda elegível para receber interesse (mesmos critérios da fila de extras). */
export function isPendingCfcExtra(current: any, module: string): boolean {
  return !!current && module === 'CFC' && current.examType !== 'PCD' &&
    !['PCD', 'CNH_BRASIL'].includes(current.schoolId) &&
    current.status === 'WAITING_SCHEDULING' && !current.attendanceConfirmed;
}

export function interestError(
  current: any,
  module: string,
  role: string | undefined,
  examiner: { id?: string | null; name?: string | null } | null | undefined,
): { status: number; error: string } | null {
  if (!canRegisterInterest(role)) return { status: 403, error: 'Somente examinadores podem registrar interesse.' };
  if (!examiner?.id) return { status: 403, error: 'Usuário sem examinador vinculado.' };
  if (!isPendingCfcExtra(current, module)) {
    return { status: 409, error: 'Este pedido não está mais na fila de provas extras. Atualize a lista.' };
  }
  const list: InterestedExaminer[] = Array.isArray(current.interestedExaminers) ? current.interestedExaminers : [];
  if (list.some(i => i.examinerId === examiner.id)) {
    return { status: 409, error: 'Interesse já registrado para este pedido.' };
  }
  return null;
}

/** Lista resultante após registrar o interesse (idempotente por examinador). */
export function interestPatch(
  current: any,
  examiner: { id: string; name: string },
  now: Date = new Date(),
): { interestedExaminers: InterestedExaminer[] } {
  const list: InterestedExaminer[] = Array.isArray(current?.interestedExaminers) ? current.interestedExaminers : [];
  if (list.some(i => i.examinerId === examiner.id)) return { interestedExaminers: list };
  return {
    interestedExaminers: [...list, { examinerId: examiner.id, name: examiner.name, registeredAt: now.toISOString() }],
  };
}

/**
 * Filtra pedidos de prova extra conforme as categorias do examinador.
 * Regra: o pedido aparece se TODAS as categorias pedidas estiverem entre as
 * categorias do examinador (ex.: examinador "A,B" vê pedidos A, B e A,B; não vê C/D/E).
 * Examinador sem categorias cadastradas não vê nenhum pedido.
 */
export function examinerCoversRequest(examinerCategories: string[] | null | undefined, intendedCategory: string | null | undefined): boolean {
  const mine = new Set((examinerCategories ?? []).map(c => String(c).trim().toUpperCase()).filter(Boolean));
  if (mine.size === 0) return false;
  const wanted = String(intendedCategory ?? '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  if (wanted.length === 0) return false;
  return wanted.every(c => mine.has(c));
}
