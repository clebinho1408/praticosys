import type { D1Database } from '@cloudflare/workers-types';

export const CADASTRO_TABS_D1_VERSION = 'd1_cadastro_tabs_v1';
export const CADASTRO_TABS_D1_STATEMENTS = [
  `ALTER TABLE usuarios ADD COLUMN abas_cadastro_permitidas TEXT DEFAULT '[]' CHECK (abas_cadastro_permitidas IS NULL OR json_valid(abas_cadastro_permitidas))`,
];
// Released SQL is immutable, independently of future ORM changes.
export const CADASTRO_TABS_D1_CHECKSUM = 'dc93e86433a03f5eeb92f902529c485f6babe0669d88a28cfcb3b3a2986b3496';

export async function cadastroTabsD1Checksum(): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(CADASTRO_TABS_D1_STATEMENTS.join(';\n')));
  const checksum = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  if (checksum !== CADASTRO_TABS_D1_CHECKSUM) throw new Error('A migração D1 de abas de cadastro foi alterada. Crie uma nova versão.');
  return checksum;
}

// Explicit maintenance only. DDL and marker commit together or not at all.
export async function migrateCadastroTabsD1(binding: D1Database): Promise<void> {
  const checksum = await cadastroTabsD1Checksum();
  const applied = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(CADASTRO_TABS_D1_VERSION).first<{ checksum: string }>();
  if (applied) {
    if (applied.checksum !== checksum) throw new Error('Migração D1 de abas de cadastro incompatível.');
    return;
  }
  await binding.batch([
    ...CADASTRO_TABS_D1_STATEMENTS.map(s => binding.prepare(s)),
    binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)')
      .bind(CADASTRO_TABS_D1_VERSION, checksum, new Date().toISOString()),
  ]);
}
