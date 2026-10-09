import { d1Binding } from './_d1.js';
import { decodeD1Row } from './_d1-sql.js';
import { d1Tables, quote, d1AllocationTriggers, d1DropAllocationTriggers } from '../db/d1-schema.js';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export const D1_PAYLOAD_LIMIT = 8_000_000;
const PART_BYTES = 900_000;
export const BACKUP_TABLES = [
  'autoescolas', 'examinadores', 'instrutores', 'veiculos', 'cidades',
  'solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd', 'vagas_cfc', 'vagas_pcd',
  'resultados_banca', 'locais_exame', 'datas_bloqueadas', 'configuracoes',
  'solicitacoes', 'bancas', 'vagas_banca',
];

export function splitD1Text(text: string): string[] {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > D1_PAYLOAD_LIMIT) throw new Error('Conteúdo excede o limite seguro de 8 MB deste fluxo D1. Avalie R2/processamento dedicado; nenhuma gravação foi feita.');
  const parts: string[] = [];
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  for (let start = 0; start < bytes.length;) {
    let end = Math.min(start + PART_BYTES, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(decoder.decode(bytes.slice(start, end)));
    start = end;
  }
  return parts.length ? parts : [''];
}

export function backupPartStatements(binding: D1Database, id: string, text: string) {
  return splitD1Text(text).map((part, index) => binding.prepare(
    'INSERT INTO backups_partes (backup_id, parte, dados) VALUES (?, ?, ?)',
  ).bind(id, index, part));
}
export async function d1PayloadChecksum(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), v => v.toString(16).padStart(2, '0')).join('');
}

export async function createD1Backup(db: any, trigger: 'auto' | 'manual') {
  const binding = d1Binding(db);
  if (trigger === 'auto') {
    const existing = await binding.prepare("SELECT id FROM backups WHERE tipo_gatilho = 'auto' AND date(criado_em) = date('now')").first();
    if (existing) return { skipped: true };
  }
  const userColumns = d1Tables.usuarios.filter(c => c.name !== 'senha').map(c => quote(c.name)).join(', ');
  // All tables are read in a single consistent atomic batch. Failures are not
  // converted to empty arrays: an incomplete snapshot is not a valid backup.
  const results = await binding.batch([
    ...BACKUP_TABLES.map(t => binding.prepare(`SELECT * FROM ${quote(t)}`)),
    binding.prepare(`SELECT ${userColumns} FROM usuarios`),
  ]);
  const payload = Object.fromEntries([...BACKUP_TABLES, 'usuarios'].map((t, index) =>
    [t, results[index].results.map(row => decodeD1Row(row as Record<string, unknown>))]));
  const text = JSON.stringify(payload), id = crypto.randomUUID();
  const parts = backupPartStatements(binding, id, text);
  const bytes = new TextEncoder().encode(text).length, checksum = await d1PayloadChecksum(text);
  try {
    await binding.batch([
      binding.prepare('INSERT INTO backups (id, tipo_gatilho, dados, tamanho_bytes, criado_em, tamanho_armazenado_bytes, checksum_sha256) VALUES (?, ?, NULL, ?, ?, ?, ?)')
        .bind(id, trigger, bytes, new Date().toISOString(), bytes, checksum),
      ...parts,
      binding.prepare('DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY criado_em DESC, id DESC LIMIT 15)'),
    ]);
  } catch (e) {
    // A competing auto backup may have won the daily unique key. Only that
    // verified conflict is "skipped"; all other failures remain explicit.
    if (trigger === 'auto' && String(e).includes('UNIQUE constraint failed: index')) {
      const exists = await binding.prepare("SELECT id FROM backups WHERE tipo_gatilho = 'auto' AND date(criado_em) = date('now')").first();
      if (exists) return { skipped: true };
    }
    throw e;
  }
  return { id };
}

export async function readD1Backup(db: any, id: string) {
  const binding = d1Binding(db);
  const stored = await binding.prepare('SELECT id, dados, tamanho_bytes, criado_em, tamanho_armazenado_bytes, checksum_sha256 FROM backups WHERE id = ?').bind(id)
    .first<{ id: string; dados: string | null; tamanho_bytes: number; criado_em: string; tamanho_armazenado_bytes: number | null; checksum_sha256: string | null }>();
  if (!stored) return null;
  let text = stored.dados;
  if (text === null) {
    const chunks = await binding.prepare('SELECT parte, dados FROM backups_partes WHERE backup_id = ? ORDER BY parte')
      .bind(id).all<{ parte: number; dados: string }>();
    if (!chunks.results.length || chunks.results.some((p, i) => p.parte !== i)) throw new Error('Backup incompleto: partes ausentes.');
    text = chunks.results.map(p => p.dados).join('');
    if (new TextEncoder().encode(text).length !== (stored.tamanho_armazenado_bytes ?? stored.tamanho_bytes)) throw new Error('Backup incompleto: tamanho diferente do original.');
  }
  if (stored.checksum_sha256 && await d1PayloadChecksum(text) !== stored.checksum_sha256) throw new Error('Backup corrompido: checksum não confere.');
  return { id: stored.id, payload: JSON.parse(text), created_at: stored.criado_em };
}

// Bulk JSON selects preserve atomic restoration without a query per record.
// Group by supplied columns to preserve omitted credentials and optional data.
export function d1ImportStatements(binding: D1Database, tableName: string, rows: Record<string, unknown>[]) {
  const columns = d1Tables[tableName];
  if (!columns) throw new Error('Tabela desconhecida na importação D1.');
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    if (row.id === undefined || row.id === null) throw new Error('Registro de importação sem ID.');
    const names = Object.keys(row).sort();
    if (names.some(name => !columns.some(c => c.name === name))) throw new Error('Coluna desconhecida na importação D1; revise o mapeamento.');
    const key = names.join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const statements: D1PreparedStatement[] = [];
  for (const [key, group] of groups) {
    const names = key.split('|'), nonId = names.filter(n => n !== 'id');
    const select = names.map(n => `json_extract(value, '$.${n}')`).join(', ');
    const conflict = nonId.length ? `DO UPDATE SET ${nonId.map(n => `${quote(n)} = excluded.${quote(n)}`).join(', ')}` : 'DO NOTHING';
    const query = `INSERT INTO ${quote(tableName)} (${names.map(quote).join(', ')}) SELECT ${select} FROM json_each(?) WHERE true ON CONFLICT (id) ${conflict}`;
    let chunk: Record<string, unknown>[] = [], size = 2;
    for (const row of group) {
      const bytes = new TextEncoder().encode(JSON.stringify(row)).length + 1;
      if (bytes > PART_BYTES) throw new Error('Registro excede o tamanho seguro para importar no D1.');
      if (size + bytes > PART_BYTES && chunk.length) {
        statements.push(binding.prepare(query).bind(JSON.stringify(chunk))); chunk = []; size = 2;
      }
      chunk.push(row); size += bytes;
    }
    if (chunk.length) statements.push(binding.prepare(query).bind(JSON.stringify(chunk)));
  }
  return statements;
}

export async function restoreD1Backup(db: any, normalized: Record<string, Record<string, unknown>[]>) {
  const binding = d1Binding(db);
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > D1_PAYLOAD_LIMIT) {
    throw new Error('Restauração excede o limite seguro de 8 MB; nenhuma gravação foi feita.');
  }
  const records = Object.entries(normalized).flatMap(([t, rows]) => d1ImportStatements(binding, t, rows));
  // A historical snapshot may legitimately exceed today's rotation settings.
  // Schema changes + restoration + reinstatement share ONE atomic batch.
  // No concurrent allocation can run with the guards disabled.
  const statements = !records.length ? [] : [
    ...d1DropAllocationTriggers().map(s => binding.prepare(s)), ...records,
    ...d1AllocationTriggers().map(s => binding.prepare(s)),
  ];
  if (statements.length > 40) throw new Error('Restauração excede o limite seguro de 40 consultas D1; nada foi alterado. Use um procedimento dedicado.');
  if (statements.length) await binding.batch(statements);
}
