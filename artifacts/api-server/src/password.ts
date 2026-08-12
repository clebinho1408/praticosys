// artifacts/api-server/src/password.ts — utilitário de senha com bcrypt (Express)
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/** Gera o hash bcrypt de uma senha em texto puro. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verifica se a senha fornecida é válida.
 * Suporta migração transparente: senhas antigas ainda em texto puro são
 * aceitas e o hash é retornado para que o chamador atualize o banco.
 * Retorna `{ ok, needsRehash, hash? }`.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash?: boolean; hash?: string }> {
  if (!stored) return { ok: false };

  // Senha já criptografada com bcrypt
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    const ok = await bcrypt.compare(plain, stored);
    return { ok };
  }

  // Senha legada em texto puro — migração transparente
  if (plain === stored) {
    const hash = await hashPassword(plain);
    return { ok: true, needsRehash: true, hash };
  }
  return { ok: false };
}
