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
