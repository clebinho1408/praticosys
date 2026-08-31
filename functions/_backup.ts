// functions/_backup.ts — geração de snapshot de backup (Cloudflare Pages Functions)
import { sql } from 'drizzle-orm';
export { normalizeBackupPayload, restoreBackup } from './_backup-restore.js';

// Tabelas de dados incluídas no backup (sessões, OTPs e logs de auditoria ficam fora)
const BACKUP_TABLES = [
  'autoescolas', 'examinadores', 'instrutores', 'veiculos', 'cidades',
  // Tabelas separadas por módulo
  'solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd',
  'vagas_cfc', 'vagas_pcd',
  'resultados_banca', 'locais_exame', 'datas_bloqueadas', 'configuracoes',
  // Tabelas legadas mantidas para segurança/rollback
  'solicitacoes', 'bancas', 'vagas_banca',
];

const MAX_BACKUPS = 15;

export async function ensureBackupSchema(db: any) {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS backups (
      id text PRIMARY KEY,
      tipo_gatilho text NOT NULL DEFAULT 'manual',
      dados jsonb NOT NULL,
      tamanho_bytes integer DEFAULT 0,
      criado_em timestamp DEFAULT now()
    )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily
      ON backups ((criado_em::date)) WHERE tipo_gatilho = 'auto'`);
  } catch {}
}

/** Cria um backup completo. Para trigger 'auto', no máximo 1 por dia. */
export async function createBackup(db: any, trigger: 'auto' | 'manual'): Promise<{ skipped?: boolean; id?: string }> {
  await ensureBackupSchema(db);

  if (trigger === 'auto') {
    const existing = await db.execute(sql`
      SELECT id FROM backups WHERE tipo_gatilho = 'auto' AND criado_em::date = CURRENT_DATE LIMIT 1
    `);
    const rows = (existing as any).rows ?? existing;
    if (rows && rows.length > 0) return { skipped: true };
  }

  const payload: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    try {
      const res = await db.execute(sql.raw(`SELECT * FROM ${t}`));
      payload[t] = (res as any).rows ?? res;
    } catch { payload[t] = []; }
  }
  // Usuários sem senhas
  try {
    const res = await db.execute(sql`
      SELECT id, nome AS name, login, perfil AS role,
             autoescola_id AS school_id, examinador_id AS examiner_id, instrutor_id AS instructor_id,
             email, telefone AS phone, dois_fatores_ativo AS two_factor_enabled,
             forcar_troca_senha AS force_password_change,
             modulos_permitidos AS allowed_modules, locais_permitidos_ids AS allowed_location_ids,
             criado_em AS created_at
      FROM usuarios
    `);
    payload['users'] = (res as any).rows ?? res;
  } catch { payload['users'] = []; }

  const id = crypto.randomUUID();
  const jsonStr = JSON.stringify(payload);
  const size = new TextEncoder().encode(jsonStr).length;

  // ON CONFLICT DO NOTHING + índice único parcial garantem no máx. 1 backup 'auto' por dia,
  // mesmo com logins de admin concorrentes.
  const inserted = await db.execute(sql`
    INSERT INTO backups (id, tipo_gatilho, dados, tamanho_bytes)
    VALUES (${id}, ${trigger}, ${jsonStr}::jsonb, ${size})
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  const insertedRows = (inserted as any).rows ?? inserted;
  if (!insertedRows || insertedRows.length === 0) return { skipped: true };
  // Retenção: mantém apenas os mais recentes
  await db.execute(sql`
    DELETE FROM backups
    WHERE id NOT IN (SELECT id FROM backups ORDER BY criado_em DESC LIMIT ${MAX_BACKUPS})
  `);
  return { id };
}
