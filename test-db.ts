import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

async function test() {
  try {
    const res = await db.execute(sql`SELECT 1`);
    console.log("Conexão com banco de dados bem-sucedida:", res);
  } catch (e) {
    console.error("Erro na conexão com banco de dados:", e);
  }
}
test();
