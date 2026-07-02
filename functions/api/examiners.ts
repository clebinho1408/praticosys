// functions/api/examiners.ts  →  GET|POST|PUT|DELETE /api/examiners
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examiners } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS default_max_slots_a integer`);
    await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS default_max_slots_b integer`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      await ensureSchema(db);
      return json(await db.select().from(examiners));
    }

    if (method === 'POST') {
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      const newItem = await db.insert(examiners).values({ id: crypto.randomUUID(), ...body }).returning();
      return json(newItem[0]);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, createdAt, updatedAt, ...updates } = body;
      const updated = await db.update(examiners).set(updates).where(eq(examiners.id, id)).returning();
      return json(updated[0]);
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(examiners).where(eq(examiners.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
