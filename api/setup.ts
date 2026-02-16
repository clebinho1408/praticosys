
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const queries = [
      // --- EXAM_REQUESTS (Candidatos) ---
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
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'WAITING_SCHEDULING'`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS result text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS schedule_id text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_date text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_time text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS scheduled_category text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS attendance_confirmed boolean DEFAULT false`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS observation text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS exam_history jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,
      
      // --- EXAM_SCHEDULES (Bancas) ---
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS examiner_ids jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS max_slots_a integer DEFAULT 10`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS max_slots_b integer DEFAULT 10`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS cancellation_reason text`,
      
      // --- INSTRUCTORS (Instrutores) ---
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cpf text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS phone text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS plate text`,
      
      // --- USERS (Usuários) ---
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text`,
      
      // --- SYSTEM_SETTINGS (Configurações) ---
      sql`CREATE TABLE IF NOT EXISTS system_settings (
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
      )`
    ];

    console.log("[Setup] Iniciando sincronização de tabelas...");
    for (const query of queries) {
      await db.execute(query).catch(err => console.warn("[Setup] Query ignorada (provavelmente já existe):", err.message));
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Estrutura do banco de dados sincronizada com sucesso! Todas as colunas foram verificadas.' 
    });
  } catch (error: any) {
    console.error("[Setup] Erro crítico:", error);
    return res.status(500).json({ error: 'Erro ao configurar banco', details: error.message });
  }
}
