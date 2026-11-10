import type { D1Database } from '@cloudflare/workers-types';

/**
 * Pátios múltiplos por autoescola (tipo + endereço + referência) e registro de
 * interesse de examinadores em pedidos de prova extra (módulo CFC).
 *
 * - autoescolas.patios: JSON [{ id, type: 'MOTO'|'CARRO'|'MUDANCA', address, reference? }]
 * - solicitacoes_cfc.examinadores_interessados: JSON [{ examinerId, name, registeredAt }]
 */
export const YARDS_INTEREST_VERSION = 'd1_school_yards_interest_v1';
export const YARDS_INTEREST_STATEMENTS = [
  `ALTER TABLE autoescolas ADD COLUMN patios TEXT DEFAULT '[]' CHECK (patios IS NULL OR json_valid(patios))`,
  `ALTER TABLE solicitacoes_cfc ADD COLUMN examinadores_interessados TEXT DEFAULT '[]' CHECK (examinadores_interessados IS NULL OR json_valid(examinadores_interessados))`,
];
export const YARDS_INTEREST_NEON_SQL = `DO $$ BEGIN
  ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS patios jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE solicitacoes_cfc ADD COLUMN IF NOT EXISTS examinadores_interessados jsonb DEFAULT '[]'::jsonb;
END $$`;

export async function yardsInterestChecksum(): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(YARDS_INTEREST_STATEMENTS.join(';\n')));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}

// Explicit maintenance only. DDL and marker commit together or not at all.
export async function migrateYardsInterestD1(binding: D1Database): Promise<void> {
  const checksum = await yardsInterestChecksum();
  const applied = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(YARDS_INTEREST_VERSION).first<{ checksum: string }>();
  if (applied) {
    if (applied.checksum !== checksum) throw new Error('Migração D1 de pátios/interesse incompatível.');
    return;
  }
  await binding.batch([
    ...YARDS_INTEREST_STATEMENTS.map(statement => binding.prepare(statement)),
    binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)')
      .bind(YARDS_INTEREST_VERSION, checksum, new Date().toISOString()),
  ]);
}
