// Pure shared contract: no database, credentials or runtime-specific imports.
export type CnhExamModality = 'STANDARD' | 'PCD' | 'REABILITACAO';
export type CnhExamCategory = 'A' | 'B';
export interface CnhExamModalities {
  examModalityA?: CnhExamModality | null;
  examModalityB?: CnhExamModality | null;
  instructor?: string | null;
  intendedCategory?: string | null;
  scheduledCategory?: string | null;
}

export function modalityField(category: CnhExamCategory) {
  return category === 'A' ? 'examModalityA' : 'examModalityB';
}

export function categoryInstructor(request: CnhExamModalities, category: CnhExamCategory): string {
  const instructor = request.instructor ?? '';
  if (request.intendedCategory !== 'AB') return instructor;
  const prefix = category === 'A' ? 'Moto:' : 'Carro:';
  return instructor.split(' / ').find(part => part.trim().startsWith(prefix))
    ?.trim().slice(prefix.length).trim() ?? '';
}

export function examModality(request: CnhExamModalities, category: CnhExamCategory): CnhExamModality {
  const explicit = request[modalityField(category)];
  // STANDARD deliberately overrides legacy sentinel values after unchecking.
  if (explicit) return explicit;
  const legacy = categoryInstructor(request, category).trim().toUpperCase();
  if (legacy === 'PROVA DE DIRECAO PCD') return 'PCD';
  if (legacy === 'PROVA DE REABILITACAO') return 'REABILITACAO';
  return 'STANDARD';
}

export function receiptCategory(request: CnhExamModalities): CnhExamCategory {
  return (request.scheduledCategory || request.intendedCategory) === 'A' ? 'A' : 'B';
}

export function specialExamLabel(request: CnhExamModalities): string | null {
  const modality = examModality(request, receiptCategory(request));
  return modality === 'PCD' ? 'PROVA DE DIREÇÃO PCD'
    : modality === 'REABILITACAO' ? 'PROVA DE REABILITAÇÃO' : null;
}

export function receiptInstructor(request: CnhExamModalities): string {
  const name = categoryInstructor(request, receiptCategory(request)).trim();
  return ['PROVA DE DIRECAO PCD', 'PROVA DE REABILITACAO'].includes(name.toUpperCase()) ? '' : name;
}

export function modalityValidationError(data: Record<string, unknown>): string | null {
  for (const field of ['examModalityA', 'examModalityB']) {
    const value = data[field];
    if (value !== undefined && value !== null
      && value !== 'STANDARD' && value !== 'PCD' && value !== 'REABILITACAO') {
      return 'Selecione somente uma modalidade válida por categoria: PCD ou Reabilitação.';
    }
  }
  return null;
}
