/**
 * Pátios de autoescola: validação compartilhada (Functions + Express).
 * Cada pátio: { id, type: 'MOTO' | 'CARRO' | 'MUDANCA', address, reference? }
 */
export const YARD_TYPES = ['MOTO', 'CARRO', 'MUDANCA'] as const;
export type YardType = typeof YARD_TYPES[number];

export const YARD_TYPE_LABEL: Record<YardType, string> = {
  MOTO: 'Moto (Cat. A)',
  CARRO: 'Carro (Cat. B)',
  MUDANCA: 'Mudança (Cat. C, D, E)',
};

export interface SchoolYard {
  id: string;
  type: YardType;
  address: string;
  reference?: string;
}

/** Retorna mensagem de erro ou null. `undefined` (campo ausente) é aceito — não altera. */
export function schoolYardsValidation(body: any): string | null {
  if (body == null || body.yards === undefined) return null;
  const yards = body.yards;
  if (yards === null) return null;
  if (!Array.isArray(yards)) return 'Pátios inválidos.';
  if (yards.length > 50) return 'Limite de 50 pátios por autoescola.';
  const ids = new Set<string>();
  for (const y of yards) {
    if (!y || typeof y !== 'object' || Array.isArray(y)) return 'Pátio inválido.';
    if (typeof y.id !== 'string' || !y.id.trim()) return 'Pátio sem identificador.';
    if (ids.has(y.id)) return 'Pátio duplicado.';
    ids.add(y.id);
    if (!YARD_TYPES.includes(y.type)) return 'Selecione o tipo do pátio (Moto, Carro ou Mudança).';
    if (typeof y.address !== 'string' || !y.address.trim()) return 'Informe o endereço do pátio.';
    if (y.address.length > 300) return 'Endereço do pátio muito longo.';
    if (y.reference !== undefined && y.reference !== null &&
        (typeof y.reference !== 'string' || y.reference.length > 300)) return 'Referência do pátio inválida.';
  }
  return null;
}

/**
 * Lista de pátios para exibição: usa `yards` quando existir; caso contrário,
 * deriva dos campos legados (um endereço por tipo) para registros antigos.
 */
export function effectiveYards(school: any): SchoolYard[] {
  if (Array.isArray(school?.yards) && school.yards.length > 0) {
    return school.yards.filter((y: any) => y && YARD_TYPES.includes(y.type) && typeof y.address === 'string' && y.address.trim());
  }
  const legacy: SchoolYard[] = [];
  if (school?.motoYardAddress) legacy.push({ id: 'legacy-moto', type: 'MOTO', address: school.motoYardAddress });
  if (school?.carYardAddress) legacy.push({ id: 'legacy-carro', type: 'CARRO', address: school.carYardAddress });
  if (school?.categoryChangeYardAddress) legacy.push({ id: 'legacy-mudanca', type: 'MUDANCA', address: school.categoryChangeYardAddress });
  return legacy;
}
