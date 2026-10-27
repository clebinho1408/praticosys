import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { localD1, root, seedD1 } from './d1-runtime.js';
import { integritySummary } from './d1-integrity.js';
// @ts-ignore Shared metadata and D1 helpers.
import { d1Tables, quote, d1AllocationTriggers, d1DropAllocationTriggers } from '../../db/d1-schema.js';
// @ts-ignore Shared D1 import compiler.
import { d1ImportStatements, backupPartStatements, readD1Backup, createD1Backup } from '../../functions/_d1-backup.js';
// @ts-ignore Shared row codecs.
import { decodeD1Row } from '../../functions/_d1-sql.js';

type Snapshot = { format: 'praticosys-full-export-v1'; tables: Record<string, Record<string, unknown>[]> };
const command = process.argv[2], file = process.argv[3];
const safePath = (value: string) => {
  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(path.join(root, '.local') + path.sep)) throw new Error('Dumps devem ficar em .local, nunca no Git ou em diretórios públicos.');
  return resolved;
};
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
function normalized(table: string, row: Record<string, unknown>) {
  const columns = d1Tables[table];
  if (!columns) throw new Error(`Tabela não mapeada: ${table}. Não será descartada silenciosamente.`);
  if (Object.keys(row).some(k => !columns.some((c: any) => c.name === k))) throw new Error(`Colunas não mapeadas em ${table}. Revise antes de importar.`);
  return Object.fromEntries(Object.entries(row).map(([name, original]) => {
    const kind = columns.find((c: any) => c.name === name)!.kind;
    let value = original;
    if (kind === 'timestamp' && typeof value === 'string') {
      const withZone = /(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(value)
        ? value.replace(/([+-]\d\d)$/, '$1:00') : value.replace(' ', 'T') + 'Z';
      const date = new Date(withZone);
      if (!Number.isFinite(date.getTime())) throw new Error(`Data inválida em ${table}; importação interrompida.`);
      const fraction = /\.(\d+)/.exec(value)?.[1];
      value = fraction && fraction.length > 3 ? date.toISOString().replace(/\.\d{3}Z$/, `.${fraction}Z`) : date.toISOString();
    }
    if (kind === 'json' && typeof value === 'string') value = JSON.parse(value);
    if (kind === 'boolean' && value != null && typeof value !== 'boolean') {
      if (![0, 1].includes(value as number)) throw new Error(`Booleano inválido em ${table}.`);
      value = value === 1;
    }
    return [name, value];
  }));
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
const fingerprint = (rows: Record<string, unknown>[], key = 'id') =>
  digest(canonical(rows.slice().sort((a, b) => String(a[key]).localeCompare(String(b[key])))));

if (command === 'export-neon') {
  // This command exists for a separately approved copy, not for task validation.
  if (!process.argv.includes('--approved-real-data-export')) throw new Error('Exportação de dados reais exige autorização específica. Este comando não é executado automaticamente.');
  const output = safePath(file);
  const connection = process.env.DATA_BASE_NEON || process.env.DATABASE_URL;
  if (!connection) throw new Error('Conexão indisponível.');
  const client = neon(connection);
  const catalog = await client.transaction([client(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name", [],
  )], { readOnly: true });
  const names = catalog[0].map((r: any) => r.table_name);
  const tables = await client.transaction(names.map((n: string) => client(`SELECT * FROM ${quote(n)}`, [])),
    { readOnly: true, isolationLevel: 'RepeatableRead' });
  const snapshot: Snapshot = { format: 'praticosys-full-export-v1', tables: Object.fromEntries(names.map((n: string, i: number) => [n, tables[i]])) };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(snapshot), { mode: 0o600 });
  process.stdout.write('Exportação protegida concluída. Nenhum registro foi exibido.\n');
} else {
  const state = safePath(process.argv.find(a => a.startsWith('--state='))?.slice(8) ?? '.local/d1-transfer-state');
  const runtime = await localD1(command === 'create-fixture' ? false : state);
  const progressFile = path.join(state, 'integrity.json');
  try {
    if (command === 'export-local' || command === 'create-fixture') {
      if (command === 'create-fixture') {
        await seedD1(runtime.db);
        await runtime.binding.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(
          'legacy-synthetic-session', 'd1-admin', '2026-01-01T00:00:00.000Z', '2025-12-31T00:00:00.000Z').run();
        await runtime.binding.prepare('INSERT INTO migracoes_schema (versao, aplicado_em) VALUES (?, ?)').bind(
          'legacy-synthetic', '2025-12-31T00:00:00.000Z').run();
        await createD1Backup(runtime.db, 'manual');
      }
      const snapshot: Snapshot = { format: 'praticosys-full-export-v1', tables: {} };
      for (const table of Object.keys(d1Tables)) {
        const result = await runtime.binding.prepare(`SELECT * FROM ${quote(table)}`).all();
        snapshot.tables[table] = result.results.map((r: any) => decodeD1Row(r) as Record<string, unknown>);
        if (table === 'backups') {
          for (const row of snapshot.tables[table]) row.dados = (await readD1Backup(runtime.db, String(row.id)))!.payload;
        }
      }
      await mkdir(path.dirname(safePath(file)), { recursive: true });
      await writeFile(safePath(file), JSON.stringify(snapshot), { mode: 0o600 });
    } else if (command === 'import-local' || command === 'verify-local') {
      const text = await readFile(safePath(file), 'utf8');
      const source: Snapshot = JSON.parse(text);
      if (source.format !== 'praticosys-full-export-v1' || !source.tables || Array.isArray(source.tables)) throw new Error('Use exportação completa, não o backup administrativo.');
      // Older exports predate this operational quota table; it contains no
      // candidate data and starts empty. All historical tables remain required.
      source.tables.cotas_consulta_cpf ??= [];
      if (Object.keys(d1Tables).some(t => !(t in source.tables))) throw new Error('Exportação incompleta: faltam tabelas inventariadas. Não descarte tabelas legadas.');
      // Validate the WHOLE input before executing the first batch.
      const tables = Object.fromEntries(Object.entries(source.tables).map(([t, rows]) => {
        if (!Array.isArray(rows)) throw new Error('Tabela inválida no arquivo.');
        if (t === 'migracoes_schema') {
          if (rows.some(r => Object.keys(r).some(k => !['versao', 'aplicado_em'].includes(k)))) throw new Error('Marcador legado desconhecido.');
          if (new Set(rows.map(r => r.versao)).size !== rows.length) throw new Error('Marcadores duplicados.');
          return [t, rows.map(r => normalized(t, r))];
        }
        const values = rows.map(r => normalized(t, r));
        if (new Set(values.map(r => r.id)).size !== values.length) throw new Error(`IDs duplicados em ${t}.`);
        return [t, values];
      }));
      if (command === 'import-local') {
        let previous: any;
        try { previous = JSON.parse(await readFile(progressFile, 'utf8')); } catch {}
        if (previous?.sourceSha256 && previous.sourceSha256 !== digest(text)) throw new Error('Este ambiente contém outra importação. Use um diretório --state novo.');
        if (!previous) {
          const counts = await runtime.binding.batch(Object.keys(d1Tables).map(t => runtime.binding.prepare(`SELECT count(*) AS n FROM ${quote(t)}`)));
          if (counts.some(r => Number((r.results[0] as any).n) > 0)) throw new Error('Destino não vazio. Use um diretório --state novo; nada será apagado.');
        }
        const statements: any[] = [];
        for (const [t, rows] of Object.entries(tables)) {
          if (t === 'migracoes_schema') {
            for (const row of rows) statements.push(runtime.binding.prepare(
              'INSERT INTO migracoes_schema (versao, aplicado_em) VALUES (?, ?) ON CONFLICT (versao) DO UPDATE SET aplicado_em = excluded.aplicado_em',
            ).bind(row.versao, row.aplicado_em));
          } else if (t === 'backups') {
            for (const row of rows) {
              const payload = JSON.stringify(row.dados);
              statements.push(runtime.binding.prepare('INSERT INTO backups (id, tipo_gatilho, dados, tamanho_bytes, criado_em, tamanho_armazenado_bytes, checksum_sha256) VALUES (?, ?, NULL, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tipo_gatilho=excluded.tipo_gatilho, dados=NULL, tamanho_bytes=excluded.tamanho_bytes, criado_em=excluded.criado_em, tamanho_armazenado_bytes=excluded.tamanho_armazenado_bytes, checksum_sha256=excluded.checksum_sha256')
                .bind(row.id, row.tipo_gatilho, row.tamanho_bytes, row.criado_em, Buffer.byteLength(payload), digest(payload)));
              statements.push(runtime.binding.prepare('DELETE FROM backups_partes WHERE backup_id = ?').bind(row.id));
              statements.push(...backupPartStatements(runtime.binding, String(row.id), payload));
            }
          } else statements.push(...d1ImportStatements(runtime.binding, t, rows));
        }
        // This is a staging-only importer. Each batch is atomic; interruption
        // leaves a staging copy INCOMPLETE. Re-running is idempotent, not a live
        // cutover/restore procedure, and verification must pass before use.
        await mkdir(state, { recursive: true });
        await writeFile(progressFile, JSON.stringify({ sourceSha256: digest(text), valid: false, state: 'IMPORT_INCOMPLETE' }), { mode: 0o600 });
        try {
          await runtime.binding.batch(d1DropAllocationTriggers().map(s => runtime.binding.prepare(s)));
          for (let i = 0; i < statements.length; i += 8) await runtime.binding.batch(statements.slice(i, i + 8));
        } finally { await runtime.binding.batch(d1AllocationTriggers().map(s => runtime.binding.prepare(s))); }
      }
      const report: Record<string, unknown> = { sourceSha256: digest(text), tables: {}, valid: true, mode: 'local-only', source: integritySummary(tables) };
      const actualTables: Record<string, Record<string, unknown>[]> = {};
      for (const [t, expected] of Object.entries(tables)) {
        if (t === 'backups') {
          const ids = (await runtime.binding.prepare('SELECT id FROM backups').all()).results;
          const matches = ids.length === expected.length && (await Promise.all(expected.map(async row => {
            const actual = await readD1Backup(runtime.db, String(row.id));
            const meta = await runtime.binding.prepare('SELECT tipo_gatilho, tamanho_bytes FROM backups WHERE id = ?').bind(row.id).first<any>();
            return !!actual && canonical(actual.payload) === canonical(row.dados) && actual.created_at === row.criado_em
              && meta.tipo_gatilho === row.tipo_gatilho && meta.tamanho_bytes === row.tamanho_bytes;
          }))).every(Boolean);
          (report.tables as any)[t] = { expected: expected.length, actual: ids.length, checksumMatches: matches };
          if (!matches) report.valid = false;
          continue;
        }
        const key = t === 'migracoes_schema' ? 'versao' : 'id';
        const byId = new Map(expected.map(row => [row[key], row]));
        const actual = (await runtime.binding.prepare(`SELECT * FROM ${quote(t)}`).all()).results.map((r: any) =>
          normalized(t, decodeD1Row(r) as Record<string, unknown>)).map((r: any) =>
          Object.fromEntries(Object.keys(byId.get(r[key]) ?? r).map(k => [k, r[k]])));
        actualTables[t] = actual;
        const match = fingerprint(expected, key) === fingerprint(actual, key);
        (report.tables as any)[t] = { expected: expected.length, actual: actual.length, checksumMatches: match };
        if (!match) report.valid = false;
      }
      report.destination = integritySummary(actualTables);
      if (canonical(report.source) !== canonical(report.destination)) report.valid = false;
      await mkdir(state, { recursive: true });
      await writeFile(progressFile, JSON.stringify(report, null, 2), { mode: 0o600 });
      await writeFile(path.join(root, '.local/d1-transfer-report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      if (!report.valid) process.exitCode = 1;
    } else throw new Error('Use export-local, import-local ou verify-local com um arquivo .local. Exportação real é uma operação separada.');
  } finally { await runtime.mf.dispose(); }
}
