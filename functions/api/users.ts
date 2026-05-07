// functions/api/users.ts  →  GET|POST|PUT|DELETE /api/users
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS examiner_id text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS instructor_id text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_modules jsonb DEFAULT '[]'::jsonb`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      await ensureSchema(db);
      const data = await db.select().from(users);
      const safe = data.map(({ password, ...rest }: any) => rest);
      return json(safe);
    }

    if (method === 'POST') {
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      const newItem = await db.insert(users).values({ id: randomUUID(), password: '123456', ...body }).returning();
      const { password, ...safe } = newItem[0] as any;
      return json(safe);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, createdAt, updatedAt, ...updates } = body;
      const updated = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      const { password, ...safe } = updated[0] as any;
      return json(safe);
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(users).where(eq(users.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};

