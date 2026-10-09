import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';
import type { D1Database } from '@cloudflare/workers-types';

export const D1_NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";
export const D1_VERSION = 'd1_schema_v1';
// Freeze this released baseline. A changed generator must become a reviewed
// NEW migration; silently rewriting the applied checksum is never permitted.
export const D1_INITIAL_CHECKSUM = 'cccc65180e383fdeabad6b239c1a2cc9f51d116b42953cd287e8224372ad3d11';
export const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
export type D1Column = { name: string; kind: string; required: boolean; primary: boolean; unique: boolean; defaultSql: string };
const dialect = new PgDialect();

// The existing schema remains the source of API property names and codecs.
// This is the initial SQLite migration; the applied checksum prevents silently
// changing a migration that has already run.
export const d1Tables: Record<string, D1Column[]> = Object.fromEntries(
  Object.values(schema).map(table => {
    const config = getTableConfig(table);
    return [config.name, Object.values(getTableColumns(table)).map((column): D1Column => {
      const kind = column.dataType === 'json' ? 'json' : column.dataType === 'boolean' ? 'boolean'
        : column.dataType === 'date' ? 'timestamp' : column.dataType;
      let defaultSql = 'NULL';
      if (column.default !== undefined) {
        if (column.default && typeof column.default === 'object' && 'queryChunks' in column.default) {
          defaultSql = dialect.sqlToQuery(column.default as any).sql.replace(/now\(\)/gi, D1_NOW);
        } else if (kind === 'json') defaultSql = `'${JSON.stringify(column.default).replaceAll("'", "''")}'`;
        else if (typeof column.default === 'string') defaultSql = `'${column.default.replaceAll("'", "''")}'`;
        else if (typeof column.default === 'boolean') defaultSql = column.default ? '1' : '0';
        else defaultSql = String(column.default);
      }
      return { name: column.name, kind, required: column.notNull, primary: column.primary,
        unique: column.isUnique, defaultSql };
    })];
  }),
);

d1Tables.sessoes = [
  { name: 'id', kind: 'string', primary: true, required: true, unique: false, defaultSql: 'NULL' },
  { name: 'usuario_id', kind: 'string', primary: false, required: true, unique: false, defaultSql: 'NULL' },
  { name: 'expira_em', kind: 'timestamp', primary: false, required: true, unique: false, defaultSql: 'NULL' },
  { name: 'criado_em', kind: 'timestamp', primary: false, required: false, unique: false, defaultSql: D1_NOW },
];
d1Tables.backups = [
  { name: 'id', kind: 'string', primary: true, required: true, unique: false, defaultSql: 'NULL' },
  { name: 'tipo_gatilho', kind: 'string', primary: false, required: true, unique: false, defaultSql: "'manual'" },
  { name: 'dados', kind: 'json', primary: false, required: false, unique: false, defaultSql: 'NULL' },
  { name: 'tamanho_bytes', kind: 'number', primary: false, required: false, unique: false, defaultSql: '0' },
  { name: 'criado_em', kind: 'timestamp', primary: false, required: true, unique: false, defaultSql: D1_NOW },
];
const extra = (name: string, kind = 'string'): D1Column =>
  ({ name, kind, primary: false, required: false, unique: false, defaultSql: 'NULL' });
d1Tables.backups.push(extra('tamanho_armazenado_bytes', 'number'), extra('checksum_sha256'));
// Read-only inventory found coexisting legacy data. Preserve it physically;
// do not merge aliases or decide that unused data can be deleted.
d1Tables.sessions = d1Tables.sessoes.map(c => ({
  ...c, name: ({ usuario_id: 'user_id', expira_em: 'expires_at', criado_em: 'created_at' } as Record<string, string>)[c.name] ?? c.name,
}));
d1Tables.migracoes_schema = [
  { ...extra('versao'), primary: true, required: true },
  { ...extra('aplicado_em', 'timestamp'), defaultSql: D1_NOW },
];
d1Tables.bancas.push(extra('location_id'));
d1Tables.configuracoes.push(...['zapi_instance_id', 'zapi_token', 'zapi_client_token'].map(n => extra(n)));
d1Tables.examinadores.push(extra('categories', 'json'),
  ...['default_max_slots_a', 'default_max_slots_b', 'default_max_slots_mudanca'].map(n => extra(n, 'number')));
for (const t of ['instrutores', 'solicitacoes', 'solicitacoes_cfc', 'solicitacoes_cnhbrasil', 'solicitacoes_pcd']) d1Tables[t].push(extra('cpf_hash'));
d1Tables.veiculos.push(extra('ano_modelo'));

export function initialD1Statements(): string[] {
  const tables = Object.entries(d1Tables).map(([name, columns]) =>
    `CREATE TABLE IF NOT EXISTS ${quote(name)} (${columns.map(c =>
      `${quote(c.name)} ${['number', 'boolean'].includes(c.kind) ? 'INTEGER' : 'TEXT'}`
      + (c.primary ? ' PRIMARY KEY' : '') + (c.required ? ' NOT NULL' : '')
      + (c.unique ? ' UNIQUE' : '') + (c.defaultSql !== 'NULL' ? ` DEFAULT ${c.defaultSql}` : '')
      + (c.kind === 'json' ? ` CHECK (${quote(c.name)} IS NULL OR json_valid(${quote(c.name)}))` : '')
      + (c.kind === 'boolean' ? ` CHECK (${quote(c.name)} IS NULL OR ${quote(c.name)} IN (0, 1))` : '')
    ).join(', ')})`);
  return [
    ...tables,
    'CREATE TABLE IF NOT EXISTS migracoes_d1 (versao TEXT PRIMARY KEY, checksum TEXT NOT NULL, aplicado_em TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS backups_partes (backup_id TEXT NOT NULL REFERENCES backups(id) ON DELETE CASCADE, parte INTEGER NOT NULL, dados TEXT NOT NULL, PRIMARY KEY (backup_id, parte))',
    "CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups (date(criado_em)) WHERE tipo_gatilho = 'auto'",
    'CREATE INDEX IF NOT EXISTS sessoes_usuario_expira ON sessoes (usuario_id, expira_em)',
    'CREATE INDEX IF NOT EXISTS otp_usuario_expira ON codigos_otp (usuario_id, expira_em)',
    ...['solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd'].map(t =>
      `CREATE INDEX IF NOT EXISTS ${t}_banca_status ON ${t} (banca_id, status)`),
    'CREATE INDEX IF NOT EXISTS vagas_cfc_examinador_data ON vagas_cfc (examinador_id, data_agendada, hora_agendada)',
    'CREATE INDEX IF NOT EXISTS vagas_cfc_autoescola_data ON vagas_cfc (autoescola_id, data_agendada)',
    'CREATE INDEX IF NOT EXISTS vagas_pcd_examinador_data ON vagas_pcd (examinador_id, data_agendada)',
    ...['INSERT', 'UPDATE'].map(event => `CREATE TRIGGER IF NOT EXISTS vagas_cfc_guard_${event.toLowerCase()}
      BEFORE ${event} ON vagas_cfc
       WHEN ${event === 'INSERT' ? 'true' : `(NEW.examinador_id IS NOT OLD.examinador_id
         OR NEW.data_agendada IS NOT OLD.data_agendada OR NEW.hora_agendada IS NOT OLD.hora_agendada
         OR (OLD.status = 'CANCELLED' AND NEW.status != 'CANCELLED'))`}
         AND NEW.status != 'CANCELLED' AND NEW.examinador_id IS NOT NULL
        AND NEW.data_agendada IS NOT NULL AND NEW.hora_agendada IS NOT NULL
      BEGIN
        SELECT CASE WHEN EXISTS (
          SELECT 1 FROM vagas_cfc WHERE examinador_id = NEW.examinador_id
          AND data_agendada = NEW.data_agendada AND hora_agendada = NEW.hora_agendada
          AND status != 'CANCELLED' AND id != NEW.id
        ) THEN RAISE(ABORT, 'D1_EXAMINER_CONFLICT') END;
        SELECT CASE WHEN (
          SELECT count(*) FROM vagas_cfc WHERE examinador_id = NEW.examinador_id
          AND data_agendada = NEW.data_agendada AND status != 'CANCELLED' AND id != NEW.id
        ) >= (
          SELECT json_extract(disponibilidade_rodizio, '$.examsPerDay')
          FROM examinadores WHERE id = NEW.examinador_id AND rodizio_provas = 1
        ) THEN RAISE(ABORT, 'D1_EXAMINER_CAPACITY') END;
      END`),
  ];
}
export const d1AllocationTriggers = () => initialD1Statements().filter(s => s.startsWith('CREATE TRIGGER'));
export const d1DropAllocationTriggers = () => ['insert', 'update'].map(event => `DROP TRIGGER IF EXISTS vagas_cfc_guard_${event}`);

export async function d1Checksum(): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(initialD1Statements().join(';\n')));
  const checksum = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  if (D1_VERSION === 'd1_schema_v1' && checksum !== D1_INITIAL_CHECKSUM) {
    throw new Error('A definição da migração D1 inicial foi alterada. Prepare uma nova versão; não reescreva o checksum liberado.');
  }
  return checksum;
}

// Explicit maintenance command only; never called from a production request.
export async function migrateD1(binding: D1Database): Promise<void> {
  const checksum = await d1Checksum();
  await binding.prepare(initialD1Statements().find(s => s.startsWith('CREATE TABLE IF NOT EXISTS migracoes_d1'))!).run();
  const applied = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?').bind(D1_VERSION).first<{ checksum: string }>();
  if (applied) {
    if (applied.checksum !== checksum) throw new Error('A migração D1 aplicada foi modificada. Crie uma nova versão; não sobrescreva a anterior.');
    return;
  }
  const existing = await binding.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
  if (existing.results.some(r => !!d1Tables[r.name] || r.name === 'backups_partes')) {
    throw new Error('Destino D1 já contém tabelas sem a versão esperada. Use um ambiente novo; não adote nem altere o banco automaticamente.');
  }
  const statements = initialD1Statements().map(s => binding.prepare(s));
  // DDL + marker in one atomic batch. No BEGIN/COMMIT (D1 owns the transaction).
  await binding.batch([...statements, binding.prepare('INSERT INTO migracoes_d1 VALUES (?, ?, ?)')
    .bind(D1_VERSION, checksum, new Date().toISOString())]);
}
