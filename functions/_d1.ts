import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema.js';
import { D1_VERSION, d1Checksum } from '../db/d1-schema.js';
import { CPF_D1_VERSION, cpfD1Checksum } from '../db/cpf-migration.js';
import { CADASTRO_TABS_D1_VERSION, cadastroTabsD1Checksum } from '../db/cadastro-tabs-migration.js';
import { translateD1Sql, decodeD1Row } from './_d1-sql.js';
import type { D1Database, D1Result } from '@cloudflare/workers-types';

export const isD1 = (db: any): boolean => !!db.$d1;
export const d1Binding = (db: any): D1Database => {
  if (!db.$d1) throw new Error('Operação requer D1.');
  return db.$d1;
};

export async function verifyD1Schema(db: any) {
  if (!isD1(db)) return;
  if (db.$d1Verified) return;
  const binding = d1Binding(db);
  const applied = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(D1_VERSION).first<{ checksum: string }>();
  if (!applied || applied.checksum !== await d1Checksum()) throw new Error('Migrações D1 ausentes ou incompatíveis. Execute a manutenção de schema antes de usar o ambiente.');
  const cpf = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(CPF_D1_VERSION).first<{ checksum: string }>();
  if (!cpf || cpf.checksum !== await cpfD1Checksum()) throw new Error('Migração D1 de autopreenchimento ausente ou incompatível. Execute a manutenção de schema.');
  const tabs = await binding.prepare('SELECT checksum FROM migracoes_d1 WHERE versao = ?')
    .bind(CADASTRO_TABS_D1_VERSION).first<{ checksum: string }>();
  if (!tabs || tabs.checksum !== await cadastroTabsD1Checksum()) throw new Error('Migração D1 de abas de cadastro ausente ou incompatível. Execute a manutenção de schema.');
  db.$d1Verified = true;
}

export function createD1Db(binding: D1Database) {
  type Descriptor = { sql: string; params: unknown[]; options: { arrayMode?: boolean } };
  const prepared = (q: Descriptor) => {
    const translated = translateD1Sql(q.sql, q.params);
    return binding.prepare(translated.sql).bind(...translated.params as any[]);
  };
  const result = (r: D1Result, q: Descriptor) => ({
    rows: (r.results ?? []).map(row => decodeD1Row(row as Record<string, unknown>, q.options.arrayMode)),
    rowCount: r.meta.changes, command: q.sql.trim().split(/\s/)[0].toUpperCase(),
  });
  const client: any = (sql: string, params: unknown[] = [], options: Descriptor['options'] = {}) => {
    const descriptor = { sql, params, options };
    // Queries must remain lazy: Drizzle builds them before calling .batch().
    let execution: Promise<unknown> | undefined;
    const run = async () => {
      const alter = /^\s*ALTER TABLE (?:public\.)?(\w+) ADD COLUMN IF NOT EXISTS (\w+)/i.exec(sql);
      if (alter) {
        const info = await binding.prepare(`PRAGMA table_info("${alter[1]}")`).all<{ name: string }>();
        if (!info.results.some(c => c.name === alter[2])) throw new Error('Coluna D1 ausente; aplique uma migração versionada.');
        return { rows: [], rowCount: 0 };
      }
      return result(await prepared(descriptor).all(), descriptor);
    };
    return Object.assign(descriptor, {
      then(resolve: any, reject: any) { execution ??= run(); return execution.then(resolve, reject); },
    });
  };
  client.transaction = async (queries: Descriptor[]) => {
    if (queries.length > 40) throw new Error('Lote D1 excede o limite seguro de 40 consultas; nenhuma gravação foi executada.');
    const results = await binding.batch(queries.map(prepared));
    return results.map((r, i) => result(r, queries[i]));
  };
  const db = drizzle(client, { schema });
  Object.assign(db, { $d1: binding });
  return db;
}
