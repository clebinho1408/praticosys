// functions/api/schools.ts  →  GET|POST|PUT|DELETE /api/schools
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { drivingSchools } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS email text`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS cidade text`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS servicos jsonb DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS endereco_patio_moto text`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS endereco_patio_carro text`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS endereco_patio_mudanca text`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS banca_principal jsonb`);
    await db.execute(sql`ALTER TABLE autoescolas ADD COLUMN IF NOT EXISTS banca_provisoria jsonb`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env, data }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      await ensureSchema(db);
      return json(await db.select().from(drivingSchools));
    }

    if (method === 'POST') {
      if ((data as any)?.sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores', 403);
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      const newItem = await db.insert(drivingSchools).values({ id: crypto.randomUUID(), ...body }).returning();
      return json(newItem[0]);
    }

    if (method === 'PUT') {
      if ((data as any)?.sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores', 403);
      const body = await parseBody<any>(request);
      const { id, createdAt, ...updates } = body;
      const updated = await db.update(drivingSchools).set(updates).where(eq(drivingSchools.id, id)).returning();
      return json(updated[0]);
    }

    if (method === 'DELETE') {
      if ((data as any)?.sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores', 403);
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
