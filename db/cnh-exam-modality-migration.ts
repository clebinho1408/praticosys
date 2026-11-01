import type { D1Database } from '@cloudflare/workers-types';

export const CNH_MODALITY_VERSION = 'd1_cnh_exam_modality_v1';
export const CNH_MODALITY_STATEMENTS = ['a', 'b'].map(category =>
  `ALTER TABLE solicitacoes_cnhbrasil ADD COLUMN modalidade_exame_${category} TEXT CHECK (modalidade_exame_${category} IS NULL OR modalidade_exame_${category} IN ('STANDARD', 'PCD', 'REABILITACAO'))`);
export const CNH_MODALITY_NEON_SQL = `DO $$ BEGIN
  ALTER TABLE solicitacoes_cnhbrasil ADD COLUMN IF NOT EXISTS modalidade_exame_a text
    CHECK (modalidade_exame_a IS NULL OR modalidade_exame_a IN ('STANDARD', 'PCD', 'REABILITACAO'));
  ALTER TABLE solicitacoes_cnhbrasil ADD COLUMN IF NOT EXISTS modalidade_exame_b text
    CHECK (modalidade_exame_b IS NULL OR modalidade_exame_b IN ('STANDARD', 'PCD', 'REABILITACAO'));
END $$`;

export async function cnhModalityChecksum(): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(CNH_MODALITY_STATEMENTS.join(';\n')));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}

export async function migrateCnhModalityD1(binding: D1Database): Promise<void> {
  const checksum = await cnhModalityChecksum();
  const applied = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(CNH_MODALITY_VERSION).first<{ checksum: string }>();
  if (applied) {
    if (applied.checksum !== checksum) throw new Error('Migração D1 de modalidades CNH incompatível.');
    return;
  }
  await binding.batch([
    ...CNH_MODALITY_STATEMENTS.map(statement => binding.prepare(statement)),
    binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)')
      .bind(CNH_MODALITY_VERSION, checksum, new Date().toISOString()),
  ]);
}
