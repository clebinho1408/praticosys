import { db } from './db/index.js';
import { sql } from 'drizzle-orm';
async function run() {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`);
  console.log('Success');
  process.exit(0);
}
run();
