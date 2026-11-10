/**
 * Política de sessão compartilhada (Cloudflare Functions + Express).
 *
 * - Sessão padrão: 8 horas (computador compartilhado, sem "Manter conectado").
 * - "Manter conectado": 30 dias, com renovação deslizante — cada uso do sistema
 *   estende a validade para mais 30 dias, então quem usa com frequência nunca
 *   precisa logar de novo. Só expira após 30 dias sem uso, ao clicar em Sair,
 *   ou se a sessão for removida no servidor.
 *
 * Como a tabela `sessoes` não guarda o tipo da sessão, o tipo é inferido pelo
 * tempo restante: uma sessão com mais de SHORT_TTL_MS restante só pode ser uma
 * sessão "Manter conectado". Isso evita migração de schema (Neon e D1).
 */
export const SHORT_TTL_MS = 8 * 60 * 60 * 1000;            // 8h
export const LONG_TTL_MS = 30 * 24 * 60 * 60 * 1000;       // 30 dias
/** Evita um UPDATE por requisição: renova no máximo uma vez por hora. */
export const RENEW_THROTTLE_MS = 60 * 60 * 1000;

export function sessionTtlMs(rememberMe: unknown): number {
  return rememberMe === true || rememberMe === 'true' ? LONG_TTL_MS : SHORT_TTL_MS;
}

export function sessionExpiry(rememberMe: unknown, now: Date = new Date()): Date {
  return new Date(now.getTime() + sessionTtlMs(rememberMe));
}

/**
 * Nova data de expiração se a sessão deve ser renovada agora; `null` caso contrário.
 * Sessões curtas (8h) nunca são renovadas — comportamento anterior preservado.
 */
export function renewedExpiry(currentExpiry: Date | string | null | undefined, now: Date = new Date()): Date | null {
  if (!currentExpiry) return null;
  const expiresAt = currentExpiry instanceof Date ? currentExpiry : new Date(currentExpiry);
  if (Number.isNaN(expiresAt.getTime())) return null;
  const remaining = expiresAt.getTime() - now.getTime();
  if (remaining <= SHORT_TTL_MS) return null;                 // sessão curta (ou longa já quase no fim)
  if (remaining > LONG_TTL_MS - RENEW_THROTTLE_MS) return null; // renovada há menos de 1h
  return new Date(now.getTime() + LONG_TTL_MS);
}
