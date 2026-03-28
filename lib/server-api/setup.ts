
import { db } from '../../db/index';
import { sql } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    console.log("[Setup] Iniciando criação/sincronização de tabelas...");

    const tableQueries = [
      // 1. INSTRUTORES
      sql`CREATE TABLE IF NOT EXISTS instructors (
          id text PRIMARY KEY,
          name text NOT NULL,
          cpf text,
          phone text,
          category text,
          plate text,
          created_at timestamp DEFAULT now()
      )`,

      // 1.1 VEÍCULOS (Novo)
      sql`CREATE TABLE IF NOT EXISTS vehicles (
          id text PRIMARY KEY,
          instructor_id text NOT NULL,
          type text NOT NULL,
          brand text NOT NULL,
          model text NOT NULL,
          plate text NOT NULL,
          active boolean DEFAULT true,
          created_at timestamp DEFAULT now()
      )`,

      // 2. AUTOESCOLAS
      sql`CREATE TABLE IF NOT EXISTS driving_schools (
          id text PRIMARY KEY,
          name text NOT NULL,
          phone text,
          address text,
          created_at timestamp DEFAULT now()
      )`,

      // 3. EXAMINADORES
      sql`CREATE TABLE IF NOT EXISTS examiners (
          id text PRIMARY KEY,
          name text NOT NULL,
          registration_number text NOT NULL,
          can_exam_common boolean DEFAULT true,
          can_exam_pcd boolean DEFAULT false,
          categories jsonb DEFAULT '[]'::jsonb,
          created_at timestamp DEFAULT now()
      )`,

      // 4. BANCAS (SCHEDULES)
      sql`CREATE TABLE IF NOT EXISTS exam_schedules (
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
      )`,

      // 5. CANDIDATOS (REQUESTS)
      sql`CREATE TABLE IF NOT EXISTS exam_requests (
          id text PRIMARY KEY,
          student_name text,
          social_name text,
          cpf text,
          phone text,
          status text NOT NULL,
          created_at timestamp DEFAULT now()
      )`,

      // 6. CONFIGURAÇÕES
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
      )`,
      
      // 7. USUÁRIOS
      sql`CREATE TABLE IF NOT EXISTS users (
          id text PRIMARY KEY,
          name text NOT NULL,
          login text NOT NULL UNIQUE,
          password text,
          role text NOT NULL,
          school_id text,
          created_at timestamp DEFAULT now()
      )`,

      // 8. CIDADES
      sql`CREATE TABLE IF NOT EXISTS cities (
          id text PRIMARY KEY,
          name text NOT NULL UNIQUE,
          created_at timestamp DEFAULT now()
      )`,

      // 9. DATAS BLOQUEADAS
      sql`CREATE TABLE IF NOT EXISTS blocked_dates (
          id text PRIMARY KEY,
          date text NOT NULL,
          description text,
          is_holiday boolean DEFAULT false,
          created_at timestamp DEFAULT now()
      )`
    ];

    const columnQueries = [
      // Garantir colunas extras em exam_requests (Candidatos)
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
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS cancellation_reason text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS observation text`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS exam_history jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS examiner_id text`,
      sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS code text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`,
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text`,

      // Garantir colunas extras em instructors (FIX: Adicionado plate e cpf)
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS category text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS plate text`,
      sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cpf text`,
      
      // Colunas para driving_schools
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS email text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS city text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS moto_yard_address text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS car_yard_address text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS category_change_yard_address text`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS main_schedule jsonb`,
      sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS provisional_schedule jsonb`,
      
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cfc_whatsapp_template text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_exam_name text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_default_exam_address text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_default_exam_address_link text`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS pcd_main_schedule jsonb`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cnh_brasil_main_schedule jsonb`,
      sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS block_weekends boolean DEFAULT false`,
      
      // Remover NOT NULL de colunas que podem ser vazias em escalas automáticas
      sql`ALTER TABLE exam_requests ALTER COLUMN student_name DROP NOT NULL`,
      sql`ALTER TABLE exam_requests ALTER COLUMN cpf DROP NOT NULL`,
      sql`ALTER TABLE exam_requests ALTER COLUMN phone DROP NOT NULL`,
      sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS city text`
    ];

    // Executa criação de tabelas
    for (const query of tableQueries) {
      try {
        await db.execute(query);
        console.log("[Setup] Tabela processada com sucesso.");
      } catch (err: any) {
        console.warn("[Setup] Tabela ignorada ou erro:", err.message);
      }
    }

    // Executa adição de colunas
    console.log("[Setup] Iniciando adição de colunas...");
    for (const query of columnQueries) {
      try {
        await db.execute(query);
        console.log("[Setup] Coluna processada com sucesso.");
      } catch (err: any) {
        // Se o erro for que a coluna já existe, ignoramos silenciosamente no log de warn
        if (err.message.includes("already exists")) {
            console.log("[Setup] Coluna já existe (pulando).");
        } else {
            console.warn("[Setup] Erro ao processar coluna:", err.message);
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Tabelas criadas e sincronizadas com sucesso! Estrutura do banco atualizada.' 
    });
  } catch (error: any) {
    console.error("[Setup] Erro crítico:", error);
    return res.status(500).json({ error: 'Erro ao configurar banco', details: error.message });
  }
}
