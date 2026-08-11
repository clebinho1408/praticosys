// functions/_backup.ts — geração de snapshot de backup (Cloudflare Pages Functions)
import { sql } from 'drizzle-orm';

// Tabelas de dados incluídas no backup (sessões, OTPs e logs de auditoria ficam fora)
const BACKUP_TABLES = [
  'driving_schools', 'examiners', 'instructors', 'vehicles', 'cities',
  'exam_requests', 'exam_schedules', 'exam_schedule_slots', 'banca_results',
  'exam_locations', 'blocked_dates', 'system_settings',
];

const MAX_BACKUPS = 15;

export async function ensureBackupSchema(db: any) {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS backups (
      id text PRIMARY KEY,
      trigger_type text NOT NULL DEFAULT 'manual',
      payload jsonb NOT NULL,
      size_bytes integer DEFAULT 0,
      created_at timestamp DEFAULT now()
    )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily
      ON backups ((created_at::date)) WHERE trigger_type = 'auto'`);
  } catch {}
}

/** Cria um backup completo. Para trigger 'auto', no máximo 1 por dia. */
export async function createBackup(db: any, trigger: 'auto' | 'manual'): Promise<{ skipped?: boolean; id?: string }> {
  await ensureBackupSchema(db);

  if (trigger === 'auto') {
    const existing = await db.execute(sql`
      SELECT id FROM backups WHERE trigger_type = 'auto' AND created_at::date = CURRENT_DATE LIMIT 1
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
      SELECT id, name, login, role, school_id, examiner_id, instructor_id,
             email, phone, two_factor_enabled, force_password_change,
             allowed_modules, allowed_location_ids, created_at
      FROM users
    `);
    payload['users'] = (res as any).rows ?? res;
  } catch { payload['users'] = []; }

  const id = crypto.randomUUID();
  const jsonStr = JSON.stringify(payload);
  const size = new TextEncoder().encode(jsonStr).length;

  // ON CONFLICT DO NOTHING + índice único parcial garantem no máx. 1 backup 'auto' por dia,
  // mesmo com logins de admin concorrentes.
  const inserted = await db.execute(sql`
    INSERT INTO backups (id, trigger_type, payload, size_bytes)
    VALUES (${id}, ${trigger}, ${jsonStr}::jsonb, ${size})
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  const insertedRows = (inserted as any).rows ?? inserted;
  if (!insertedRows || insertedRows.length === 0) return { skipped: true };
  // Retenção: mantém apenas os mais recentes
  await db.execute(sql`
    DELETE FROM backups
    WHERE id NOT IN (SELECT id FROM backups ORDER BY created_at DESC LIMIT ${MAX_BACKUPS})
  `);
  return { id };
}
