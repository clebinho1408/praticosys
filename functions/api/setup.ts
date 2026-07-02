// functions/api/setup.ts  →  POST /api/setup
// Cria o usuário admin e garante existência de todas as tabelas via migrations inline.
import { getDb, json, error } from '../_db.js';
import { users } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ env }) => {
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
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS examiner_id text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS instructor_id text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb`,
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

    return json({ success: true, message: 'Tabelas criadas e sincronizadas com sucesso!' });
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
