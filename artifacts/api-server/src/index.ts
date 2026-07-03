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
