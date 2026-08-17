import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS category_quantities jsonb`);
    await db.execute(sql`
      UPDATE exam_requests
      SET
        category_quantities = (
          SELECT COALESCE(jsonb_object_agg(m[1], (m[2])::int), '{}'::jsonb)
          FROM regexp_matches(
            substring(observation from '^\\[Qtd:([A-Z0-9=,]+)\\]'),
            '([A-Z]+)=([0-9]+)',
            'g'
          ) AS m
        ),
        observation = regexp_replace(observation, '^\\[Qtd:[A-Z0-9=,]+\\] *', '')
      WHERE category_quantities IS NULL
        AND observation LIKE '[Qtd:%'
    `);
    // Exam locations table + locationId column on exam_schedules
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS exam_locations (
        id text PRIMARY KEY,
        city_id text NOT NULL,
        address text,
        maps_url text,
        regions_served jsonb DEFAULT '[]',
        created_at timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS location_id text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_location_ids jsonb DEFAULT '[]'`);
    await db.execute(sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS procuracao boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS risk_area_key text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        code text NOT NULL,
        expires_at timestamp NOT NULL,
        used boolean DEFAULT false,
        failed_attempts integer DEFAULT 0,
        created_at timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS row_color text`);
    await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS sem_duplo_comando boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS modulo text`);
    await db.execute(sql`
      UPDATE exam_requests
      SET modulo = CASE
        WHEN exam_type = 'PCD' THEN 'PCD'
        WHEN school_id IS NULL OR school_id = '' OR school_id = 'CNH_BRASIL' THEN 'CNH_BRASIL'
        WHEN school_id = 'PCD' THEN 'PCD'
        ELSE 'CFC'
      END
      WHERE modulo IS NULL OR modulo = ''
    `);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS backups (id text PRIMARY KEY, trigger_type text NOT NULL DEFAULT 'manual', payload jsonb NOT NULL, size_bytes integer DEFAULT 0, created_at timestamp DEFAULT now())`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((created_at::date)) WHERE trigger_type = 'auto'`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id text PRIMARY KEY,
        user_id text,
        user_name text,
        user_role text,
        action text NOT NULL,
        entity text NOT NULL,
        entity_id text,
        details jsonb,
        created_at timestamp DEFAULT now()
      )
    `);

    // ─── Módulo: criar tabelas separadas por módulo ────────────────────────────
    // Tabela de controle de migrações (evita re-execução de backfill)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamp DEFAULT now()
      )
    `);

    // Cria as novas tabelas (sempre idempotente)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS cnhbrasil_requests (LIKE exam_requests INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS cfc_requests (LIKE exam_requests INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS pcd_requests (LIKE exam_requests INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS cfc_schedule_slots (LIKE exam_schedule_slots INCLUDING ALL)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS pcd_schedule_slots (LIKE exam_schedule_slots INCLUDING ALL)`);
    await db.execute(sql`ALTER TABLE banca_results ADD COLUMN IF NOT EXISTS modulo text`);

    // Backfill: roda UMA ÚNICA VEZ via marcador transacional
    // DEVE rodar ANTES dos DROP COLUMN para que o SELECT * ainda funcione
    // Verifica primeiro (sem abrir tx) se já foi aplicado
    const migCheck = await db.execute(sql`SELECT 1 FROM schema_migrations WHERE version = 'module_tables_v1'`);
    const migDone = ((migCheck as any).rows ?? migCheck);
    if (!migDone || migDone.length === 0) {
      // Marcador e backfill em uma única transação: falha → rollback → retry na próxima inicialização
      logger.info("Running one-time module tables backfill...");
      await db.transaction(async (tx) => {
        await tx.execute(sql`INSERT INTO schema_migrations (version) VALUES ('module_tables_v1')`);
        await tx.execute(sql`INSERT INTO cnhbrasil_requests SELECT * FROM exam_requests WHERE modulo = 'CNH_BRASIL' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO cfc_requests SELECT * FROM exam_requests WHERE modulo = 'CFC' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO pcd_requests SELECT * FROM exam_requests WHERE modulo = 'PCD' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO cfc_schedule_slots SELECT * FROM exam_schedule_slots WHERE exam_type != 'PCD' ON CONFLICT (id) DO NOTHING`);
        await tx.execute(sql`INSERT INTO pcd_schedule_slots SELECT * FROM exam_schedule_slots WHERE exam_type = 'PCD' ON CONFLICT (id) DO NOTHING`);
      });
      logger.info("Module tables backfill complete.");
    }

    // ─── Remover colunas desnecessárias por módulo (idempotente) ──────────────
    // Executado DEPOIS do backfill para não quebrar o SELECT * na migração inicial.
    // cnhbrasil_requests: sem PCD (disability_type, special_needs), sem CFC-veículo (sem_duplo_comando), sem alocação CFC (category_quantities)
    await db.execute(sql`ALTER TABLE cnhbrasil_requests DROP COLUMN IF EXISTS disability_type`);
    await db.execute(sql`ALTER TABLE cnhbrasil_requests DROP COLUMN IF EXISTS special_needs`);
    await db.execute(sql`ALTER TABLE cnhbrasil_requests DROP COLUMN IF EXISTS sem_duplo_comando`);
    await db.execute(sql`ALTER TABLE cnhbrasil_requests DROP COLUMN IF EXISTS category_quantities`);
    // cfc_requests: sem PCD (disability_type, special_needs)
    await db.execute(sql`ALTER TABLE cfc_requests DROP COLUMN IF EXISTS disability_type`);
    await db.execute(sql`ALTER TABLE cfc_requests DROP COLUMN IF EXISTS special_needs`);
    // pcd_requests: sem CFC-veículo (sem_duplo_comando), sem alocação CFC (category_quantities)
    await db.execute(sql`ALTER TABLE pcd_requests DROP COLUMN IF EXISTS sem_duplo_comando`);
    await db.execute(sql`ALTER TABLE pcd_requests DROP COLUMN IF EXISTS category_quantities`);

    logger.info("DB migrations complete");
  } catch (err) {
    logger.warn({ err }, "DB migration step skipped or failed");
  }

}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
