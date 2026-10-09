import { neon } from '@neondatabase/serverless';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
// @ts-ignore Shared schema metadata.
import { d1Tables, quote } from '../../db/d1-schema.js';
import { root } from './d1-runtime.js';

const report: Record<string, unknown> = {
  checkedAt: new Date().toISOString(),
  limitsSource: 'https://developers.cloudflare.com/d1/platform/limits/',
  limits: { rowBytes: 2_000_000, parameters: 100, statementBytes: 100_000,
    freeDatabaseMB: 500, paidDatabaseGB: 10, freeQueriesPerInvocation: 50, paidQueriesPerInvocation: 1000 },
  implementationLimits: { snapshotBytes: 8_000_000, atomicStatements: 40 },
  expectedTables: Object.keys(d1Tables),
  liveMeasurement: false,
};
if (process.argv.includes('--neon-readonly')) {
  // No app startup/migration hooks, no exported records, no connection logging.
  const connection = process.env.DATA_BASE_NEON || process.env.DATABASE_URL;
  if (!connection) throw new Error('Conexão do aplicativo indisponível para inventário somente leitura.');
  const client = neon(connection);
  const [size, tables] = await client.transaction([
    client('SELECT pg_database_size(current_database()) AS bytes', []),
    client("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name", []),
  ], { readOnly: true, isolationLevel: 'RepeatableRead' });
  const names = tables.map((r: any) => r.table_name as string);
  const measurements = await client.transaction(names.map(name => client(
    `SELECT count(*)::integer AS records, coalesce(max(octet_length(to_jsonb(t)::text)), 0) AS largest_json_row_bytes,
     coalesce(sum(octet_length(to_jsonb(t)::text)), 0) AS estimated_json_bytes FROM ${quote(name)} t`, [],
  )), { readOnly: true, isolationLevel: 'RepeatableRead' });
  const columns = await client.transaction([client(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position", [],
  )], { readOnly: true });
  report.liveMeasurement = true;
  report.databaseBytes = Number(size[0].bytes);
  report.tables = names.map((name, i) => ({ name, ...measurements[i][0] }));
  report.columns = columns[0];
  report.unmappedTables = names.filter(n => !d1Tables[n] && n !== 'migracoes_schema');
  report.unmappedColumns = columns[0].filter((c: any) => d1Tables[c.table_name] &&
    !d1Tables[c.table_name].some((x: any) => x.name === c.column_name));
  if (names.includes('vagas_cfc')) {
    const [conflicts] = await client.transaction([client(`
      SELECT count(*)::integer AS conflicts FROM (
        SELECT examinador_id, data_agendada, hora_agendada FROM vagas_cfc
        WHERE status != 'CANCELLED' AND examinador_id IS NOT NULL AND data_agendada IS NOT NULL
          AND hora_agendada IS NOT NULL
        GROUP BY examinador_id, data_agendada, hora_agendada HAVING count(*) > 1
      ) t`, [])], { readOnly: true });
    report.existingExaminerConflicts = conflicts[0].conflicts;
  }
}
await mkdir(path.join(root, '.local'), { recursive: true });
await writeFile(path.join(root, '.local/d1-assessment.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
