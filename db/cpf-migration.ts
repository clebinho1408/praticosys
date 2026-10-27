export const CPF_D1_VERSION = 'd1_cpf_autofill_v1';
export const CPF_D1_STATEMENTS = [
  'ALTER TABLE configuracoes ADD COLUMN preencher_nome_cpf_cnh INTEGER NOT NULL DEFAULT 0 CHECK (preencher_nome_cpf_cnh IN (0, 1))',
  'CREATE TABLE cotas_consulta_cpf (id TEXT PRIMARY KEY NOT NULL, janela_minuto INTEGER NOT NULL, consultas INTEGER NOT NULL DEFAULT 0)',
  // This existing ORM field also postdates the frozen D1 baseline.
  `ALTER TABLE examinadores ADD COLUMN periodos_bloqueio TEXT DEFAULT '[]' CHECK (periodos_bloqueio IS NULL OR json_valid(periodos_bloqueio))`,
];
// Both legacy Neon backends use the same additive, idempotent evolution.
export const CPF_NEON_MIGRATION = `
  ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS preencher_nome_cpf_cnh boolean NOT NULL DEFAULT false;
  CREATE TABLE IF NOT EXISTS cotas_consulta_cpf (
    id text PRIMARY KEY, janela_minuto integer NOT NULL, consultas integer NOT NULL DEFAULT 0
  );
`;
export async function cpfD1Checksum() {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(CPF_D1_STATEMENTS.join(';\n')));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export async function migrateCpfD1(binding: any) {
  const checksum = await cpfD1Checksum();
  const existing = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(CPF_D1_VERSION).first();
  if (existing) {
    if (existing.checksum !== checksum) throw new Error('Migração de autopreenchimento D1 incompatível.');
    return;
  }
  await binding.batch([
    ...CPF_D1_STATEMENTS.map(s => binding.prepare(s)),
    binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)').bind(CPF_D1_VERSION, checksum, new Date().toISOString()),
  ]);
}
