import { db } from './db/index.js';
import { systemSettings } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
    console.log('Settings:', data);
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

main();
