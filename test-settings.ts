
import { db } from './db/index.js';
import { systemSettings } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function test() {
  try {
    const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
    console.log('Current Settings:', JSON.stringify(data[0], null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
