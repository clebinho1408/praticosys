import type { D1Database } from '@cloudflare/workers-types';

export const AUTH_SECURITY_VERSION = 'd1_auth_security_v1';
export const AUTH_SECURITY_DDL = 'CREATE TABLE IF NOT EXISTS limites_autenticacao (id text PRIMARY KEY, janela integer NOT NULL, tentativas integer NOT NULL)';
export async function authSecurityChecksum() {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(AUTH_SECURITY_DDL));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
/** Explicit maintenance only; leaves all released migration SQL/checksums intact. */
export async function migrateAuthSecurityD1(binding: D1Database) {
  const checksum = await authSecurityChecksum();
  const current = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(AUTH_SECURITY_VERSION).first<{ checksum: string }>();
  if (current) {
    if (current.checksum !== checksum) throw new Error('Migração de segurança incompatível.');
    return;
  }
  await binding.batch([
    binding.prepare(AUTH_SECURITY_DDL),
    binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)').bind(AUTH_SECURITY_VERSION, checksum, new Date().toISOString()),
  ]);
}
