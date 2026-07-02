// functions/api/schools.ts  →  GET|POST|PUT|DELETE /api/schools
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { drivingSchools } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS email text`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS city text`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS moto_yard_address text`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS car_yard_address text`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS category_change_yard_address text`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS main_schedule jsonb`);
    await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS provisional_schedule jsonb`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      await ensureSchema(db);
      return json(await db.select().from(drivingSchools));
    }

    if (method === 'POST') {
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      const newItem = await db.insert(drivingSchools).values({ id: crypto.randomUUID(), ...body }).returning();
      return json(newItem[0]);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, createdAt, ...updates } = body;
      const updated = await db.update(drivingSchools).set(updates).where(eq(drivingSchools.id, id)).returning();
      return json(updated[0]);
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(drivingSchools).where(eq(drivingSchools.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
