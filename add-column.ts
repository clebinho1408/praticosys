import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS zapi_client_token text;`);
    console.log('Column added successfully');
  } catch (error) {
    console.error('Error adding column:', error);
  }
  process.exit(0);
}

main();
