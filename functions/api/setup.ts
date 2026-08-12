// functions/api/setup.ts  →  POST /api/setup
// Cria o usuário admin e garante existência de todas as tabelas via migrations inline.
// PROTEGIDO: requer header Authorization: Bearer <SESSION_SECRET>.
import { getDb, json, error } from '../_db.js';
import { users } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { encryptCpf, decryptCpf, cpfSearchHash, validateCpfKey, isCpfEncrypted } from '../_cpf.js';

/**
 * Criptografa todos os CPFs em texto puro e migra logins de instrutores para HMAC.
 * Idempotente. Mantém set de IDs com falha para garantir progresso (sem loop infinito).
 */
async function backfillCpfEncryption(
  db: ReturnType<typeof getDb>,
  encKey: string,
): Promise<{ cpfRows: number; loginRows: number; errors: string[] }> {
  const counts = { cpfRows: 0, loginRows: 0, errors: [] as string[] };

  // 1. Criptografar CPFs em texto puro
  for (const table of ['exam_requests', 'instructors'] as const) {
    const skipped = new Set<string>();
    let keepGoing = true;
    while (keepGoing) {
      const batch: any[] = await db.execute(
        sql.raw(`SELECT id, cpf FROM ${table} WHERE cpf IS NOT NULL AND cpf != '' AND cpf NOT LIKE 'enc:%' LIMIT 100`)
      ).then((r: any) => (r as any).rows ?? r);
      const processable = batch.filter((r: any) => !skipped.has(r.id));
      if (!processable.length) { keepGoing = false; break; }
      for (const row of processable) {
        try {
          const result = await encryptCpf(row.cpf, encKey);
          if (!result) { skipped.add(row.id); counts.errors.push(`${table}:${row.id}:null`); continue; }
          await db.execute(
            sql`UPDATE ${sql.raw(table)} SET cpf = ${result.enc}, cpf_hash = ${result.hash} WHERE id = ${row.id}`
          );
          counts.cpfRows++;
        } catch (e: any) {
          skipped.add(row.id);
          counts.errors.push(`${table}:${row.id}:${e?.message ?? 'err'}`);
        }
      }
    }
  }

  // 2. Migrar logins de instrutores de CPF em texto puro → HMAC
  const userRows: any[] = await db.execute(sql`
    SELECT u.id, u.login, i.cpf AS instructor_cpf
    FROM users u
    LEFT JOIN instructors i ON i.id = u.instructor_id
    WHERE u.role = 'INSTRUCTOR' AND u.login ~ '^[0-9]{10,11}$'
  `).then((r: any) => (r as any).rows ?? r);

  for (const u of userRows) {
    try {
      const rawCpf = isCpfEncrypted(u.instructor_cpf)
        ? await decryptCpf(u.instructor_cpf, encKey)
        : u.instructor_cpf;
      // Fallback: se o instrutor não tem CPF gravado, o login em si são os dígitos
      const digits = rawCpf?.replace(/\D/g, '') || u.login;
      if (!digits) continue;
      const hmac = await cpfSearchHash(digits, encKey);
      await db.execute(sql`UPDATE users SET login = ${hmac} WHERE id = ${u.id}`);
      counts.loginRows++;
    } catch (e: any) {
      counts.errors.push(`user:${u.id}:${e?.message ?? 'err'}`);
    }
  }

  // 3. Invalidar backups com CPFs em texto puro no payload
  const deleted: any = await db.execute(sql`
    DELETE FROM backups
    WHERE
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'instructors', '[]'::jsonb)) AS e
        WHERE e->>'cpf' IS NOT NULL AND e->>'cpf' != '' AND e->>'cpf' NOT LIKE 'enc:%'
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'exam_requests', '[]'::jsonb)) AS e
        WHERE e->>'cpf' IS NOT NULL AND e->>'cpf' != '' AND e->>'cpf' NOT LIKE 'enc:%'
      )
  `);
  counts.cpfRows += deleted?.rowCount ?? 0;

  return counts;
}

export const onRequestPost: PagesFunction<{ DATABASE_URL: string; SESSION_SECRET?: string; DATA_ENCRYPTION_KEY?: string }> = async ({ env, request }) => {
  // Proteção: requer o SESSION_SECRET no header de autorização.
  // Isso impede que qualquer pessoa na internet dispare DDL ou reset de admin.
  const sessionSecret = (env as any).SESSION_SECRET as string | undefined;
  const authHeader = request.headers.get('Authorization') ?? '';
  if (!sessionSecret || authHeader !== `Bearer ${sessionSecret}`) {
    return error('Acesso não autorizado. Forneça o header Authorization: Bearer <SESSION_SECRET>.', 401);
  }

  try {
    const db = getDb(env as any);

    const tables = [
      sql`CREATE TABLE IF NOT EXISTS instructors (id text PRIMARY KEY, name text NOT NULL, cpf text, phone text, category text, plate text, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS vehicles (id text PRIMARY KEY, instructor_id text NOT NULL, type text NOT NULL, brand text NOT NULL, model text NOT NULL, plate text NOT NULL, active boolean DEFAULT true, transmission text, accessories jsonb DEFAULT '[]'::jsonb, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS driving_schools (id text PRIMARY KEY, name text NOT NULL, phone text, address text, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS examiners (id text PRIMARY KEY, name text NOT NULL, registration_number text NOT NULL, can_exam_common boolean DEFAULT true, can_exam_pcd boolean DEFAULT false, categories jsonb DEFAULT '[]'::jsonb, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS exam_schedules (id text PRIMARY KEY, date text NOT NULL, time text NOT NULL, examiner_ids jsonb DEFAULT '[]'::jsonb, max_slots_a integer DEFAULT 10, max_slots_b integer DEFAULT 10, type text NOT NULL, status text NOT NULL, cancellation_reason text, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS exam_requests (id text PRIMARY KEY, student_name text, social_name text, cpf text, phone text, status text NOT NULL, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS system_settings (id integer PRIMARY KEY DEFAULT 1, agency_name text DEFAULT 'DETRAN', maintenance_mode boolean DEFAULT false, min_days_scheduling integer DEFAULT 2, max_daily_slots integer DEFAULT 50, default_max_slots_a integer DEFAULT 10, default_max_slots_b integer DEFAULT 10)`,
      sql`CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, name text NOT NULL, login text NOT NULL UNIQUE, password text, role text NOT NULL, school_id text, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS cities (id text PRIMARY KEY, name text NOT NULL UNIQUE, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS blocked_dates (id text PRIMARY KEY, date text NOT NULL, description text, is_holiday boolean DEFAULT false, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS banca_results (id text PRIMARY KEY, schedule_id text, school_id text, category text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS exam_schedule_slots (id text PRIMARY KEY, school_id text NOT NULL, exam_type text NOT NULL, request_type text NOT NULL DEFAULT 'FIXA', intended_category text, scheduled_date text, scheduled_time text, examiner_id text, schedule_id text, scheduled_category text, status text NOT NULL DEFAULT 'SCHEDULED', attendance_confirmed boolean DEFAULT false, cancellation_reason text, observation text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS exam_locations (id text PRIMARY KEY, city_id text NOT NULL, address text, maps_url text, regions_served jsonb DEFAULT '[]'::jsonb, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY, user_id text, user_name text, user_role text, action text NOT NULL, entity text NOT NULL, entity_id text, details jsonb, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS otp_codes (id text PRIMARY KEY, user_id text NOT NULL, code text NOT NULL, expires_at timestamp NOT NULL, used boolean DEFAULT false, failed_attempts integer DEFAULT 0, created_at timestamp DEFAULT now())`,
      sql`ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0`,
      sql`CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS backups (id text PRIMARY KEY, trigger_type text NOT NULL DEFAULT 'manual', payload jsonb NOT NULL, size_bytes integer DEFAULT 0, created_at timestamp DEFAULT now())`,
      sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((created_at::date)) WHERE trigger_type = 'auto'`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS cpf_hash text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cpf_hash text`,
    ];

    const columns = [
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS address text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS city text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS exam_type text DEFAULT 'COMMON'`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS intended_category text DEFAULT 'B'`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS source text DEFAULT 'SCHOOL'`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS school_id text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS paid_fee boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS completed_practical_course boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS practical_hours integer DEFAULT 0`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS has_vehicle boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS cnh_restriction text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS instructor text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS vehicle_plate text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS disability_type text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS special_needs text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS result text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS schedule_id text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_date text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_time text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_category text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS attendance_confirmed boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS cancellation_reason text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS observation text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS exam_history jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS queue_updated_at timestamptz`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS examiner_id text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'EXTRA'`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS checklist_vehicle boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS practical_course_inserted boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS taxa_paga boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_by text`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS code text`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS location_id text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS examiner_id text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS instructor_id text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_location_ids jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS category text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS plate text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cpf text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS city text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS moto_yard_address text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS car_yard_address text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS category_change_yard_address text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS main_schedule jsonb`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS provisional_schedule jsonb`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS agency_address text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS logo_url text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cfc_whatsapp_template text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS whatsapp_message_template text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_exam_address text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_exam_address_link text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_exam_name text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_default_exam_address text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_default_exam_address_link text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_main_schedule jsonb`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cnh_brasil_main_schedule jsonb`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS block_weekends boolean DEFAULT false`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_max_slots_mudanca integer DEFAULT 10`,
      sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS total_slots integer DEFAULT 0`,
      sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS used_slots integer DEFAULT 0`,
      sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS approved integer DEFAULT 0`,
      sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS failed integer DEFAULT 0`,
      sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS absent integer DEFAULT 0`,
      sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS cancelled integer DEFAULT 0`,
      sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS procuracao boolean DEFAULT false`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS risk_area_key text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false`,
    ];

    for (const q of tables) { try { await db.execute(q); } catch {} }
    for (const q of columns) { try { await db.execute(q); } catch {} }

    // Criar usuário admin se não existir
    try {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        name: 'Administrador',
        login: 'admin',
        role: 'ADMIN',
        forcePasswordChange: false,
      }).onConflictDoNothing();
    } catch {}

    // Backfill: criptografa CPFs em texto puro se a chave estiver configurada
    const encKey = (env as any).DATA_ENCRYPTION_KEY ?? '';
    let migrationInfo: Record<string, any> = {};
    if (!validateCpfKey(encKey)) {
      try {
        migrationInfo = await backfillCpfEncryption(db, encKey);
      } catch (backfillErr: any) {
        migrationInfo = { error: backfillErr?.message ?? 'backfill failed' };
      }
    } else {
      migrationInfo = { skipped: 'DATA_ENCRYPTION_KEY não configurada — CPFs não criptografados em texto puro permanecem até que a chave seja configurada e /api/setup seja chamado novamente' };
    }

    return json({ success: true, message: 'Tabelas criadas e sincronizadas com sucesso!', cpfMigration: migrationInfo });
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
