import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { encryptCpf, decryptCpf, cpfSearchHash, validateCpfKey, isCpfEncrypted } from "./cpf.js";

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
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now())`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS backups (id text PRIMARY KEY, trigger_type text NOT NULL DEFAULT 'manual', payload jsonb NOT NULL, size_bytes integer DEFAULT 0, created_at timestamp DEFAULT now())`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS backups_auto_daily ON backups ((created_at::date)) WHERE trigger_type = 'auto'`);
    // Colunas para criptografia de CPF
    await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS cpf_hash text`);
    await db.execute(sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS cpf_hash text`);
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
    logger.info("DB migrations complete");
  } catch (err) {
    logger.warn({ err }, "DB migration step skipped or failed");
  }

  // Backfill: criptografa CPFs em texto puro e migra logins de instrutores para HMAC.
  // Processa em lotes; mantém set de IDs com falha para garantir progresso.
  const encKey = process.env.DATA_ENCRYPTION_KEY ?? '';
  if (!validateCpfKey(encKey)) {
    try {
      let total = 0;
      // 1. Criptografar CPFs em texto puro nas tabelas de dados
      for (const table of ['exam_requests', 'instructors'] as const) {
        const skipped = new Set<string>();
        let keepGoing = true;
        while (keepGoing) {
          const batch: any[] = await db.execute(
            sql.raw(`SELECT id, cpf FROM ${table} WHERE cpf IS NOT NULL AND cpf != '' AND cpf NOT LIKE 'enc:%' LIMIT 100`)
          ).then((r: any) => r.rows ?? r);
          const processable = batch.filter((r: any) => !skipped.has(r.id));
          if (!processable.length) { keepGoing = false; break; }
          for (const row of processable) {
            try {
              const result = await encryptCpf(row.cpf, encKey);
              if (!result) { skipped.add(row.id); continue; }
              await db.execute(sql`UPDATE ${sql.raw(table)} SET cpf = ${result.enc}, cpf_hash = ${result.hash} WHERE id = ${row.id}`);
              total++;
            } catch { skipped.add(row.id); }
          }
        }
      }
      // 2. Migrar logins de instrutores de CPF em texto puro → HMAC do CPF
      const userRows: any[] = await db.execute(sql`
        SELECT u.id, u.login, i.cpf AS instructor_cpf
        FROM users u
        LEFT JOIN instructors i ON i.id = u.instructor_id
        WHERE u.role = 'INSTRUCTOR' AND u.login ~ '^[0-9]{10,11}$'
      `).then((r: any) => r.rows ?? r);
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
          total++;
        } catch {}
      }
      // 3. Invalidar backups com CPFs em texto puro no payload (não re-criptografar JSON histórico)
      await db.execute(sql`
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
      logger.info({ total }, 'CPF backfill + instructor login migration complete');
    } catch (err) { logger.warn({ err }, 'CPF backfill skipped'); }
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
