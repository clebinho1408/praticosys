import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log("Iniciando migração...");
  
  try {
    // 1. INSTRUTORES
    await db.execute(sql`CREATE TABLE IF NOT EXISTS instructors (
        id text PRIMARY KEY,
        name text NOT NULL,
        cpf text,
        phone text,
        category text,
        plate text,
        created_at timestamp DEFAULT now()
    )`);

    // 1.1 VEÍCULOS
    await db.execute(sql`CREATE TABLE IF NOT EXISTS vehicles (
        id text PRIMARY KEY,
        instructor_id text NOT NULL,
        type text NOT NULL,
        brand text NOT NULL,
        model text NOT NULL,
        plate text NOT NULL,
        active boolean DEFAULT true,
        created_at timestamp DEFAULT now()
    )`);

    // 2. AUTOESCOLAS
    await db.execute(sql`CREATE TABLE IF NOT EXISTS driving_schools (
        id text PRIMARY KEY,
        name text NOT NULL,
        phone text,
        address text,
        created_at timestamp DEFAULT now()
    )`);

    // 3. EXAMINADORES
    await db.execute(sql`CREATE TABLE IF NOT EXISTS examiners (
        id text PRIMARY KEY,
        name text NOT NULL,
        registration_number text NOT NULL,
        can_exam_common boolean DEFAULT true,
        can_exam_pcd boolean DEFAULT false,
        created_at timestamp DEFAULT now()
    )`);

    // 4. BANCAS (SCHEDULES)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS exam_schedules (
        id text PRIMARY KEY,
        date text NOT NULL,
        time text NOT NULL,
        examiner_ids jsonb DEFAULT '[]'::jsonb,
        max_slots_a integer DEFAULT 10,
        max_slots_b integer DEFAULT 10,
        type text NOT NULL,
        status text NOT NULL,
        cancellation_reason text,
        created_at timestamp DEFAULT now()
    )`);

    // 5. CANDIDATOS (REQUESTS)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS exam_requests (
        id text PRIMARY KEY,
        student_name text NOT NULL,
        social_name text,
        cpf text NOT NULL,
        phone text NOT NULL,
        status text NOT NULL,
        created_at timestamp DEFAULT now()
    )`);

    // 6. CONFIGURAÇÕES
    await db.execute(sql`CREATE TABLE IF NOT EXISTS system_settings (
        id integer PRIMARY KEY DEFAULT 1,
        agency_name text DEFAULT 'DETRAN',
        agency_address text,
        logo_url text,
        maintenance_mode boolean DEFAULT false,
        min_days_scheduling integer DEFAULT 2,
        max_daily_slots integer DEFAULT 50,
        default_max_slots_a integer DEFAULT 10,
        default_max_slots_b integer DEFAULT 10,
        whatsapp_template text,
        default_exam_address text,
        default_exam_address_link text
    )`);

    // Add columns if missing
    const columns = [
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS address text`,
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
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS observation text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS exam_history jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS examiner_id text`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS code text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS category text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS plate text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cpf text`
    ];

    for (const q of columns) {
      await db.execute(q).catch(e => console.log("Coluna já existe ou erro:", e.message));
    }

    console.log("Migração concluída!");
    process.exit(0);
  } catch (e) {
    console.error("Erro na migração:", e);
    process.exit(1);
  }
}

migrate();
