import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adding default_max_slots_mudanca column to system_settings...');
    await db.execute(sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_max_slots_mudanca integer DEFAULT 10;`);
    console.log('Column added successfully');
  } catch (error) {
    console.error('Error adding column:', error);
  }
  process.exit(0);
}

main();
