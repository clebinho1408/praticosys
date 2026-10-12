// functions/api/examiners.ts  →  GET|POST|PUT|DELETE /api/examiners
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examiners } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS categorias jsonb DEFAULT '[]'::jsonb`);
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS max_vagas_a_padrao integer`);
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS max_vagas_b_padrao integer`);
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS max_vagas_mudanca_padrao integer`);
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS rodizio_provas boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS disponibilidade_rodizio jsonb`);
    await db.execute(sql`ALTER TABLE public.examinadores ADD COLUMN IF NOT EXISTS periodos_bloqueio jsonb DEFAULT '[]'::jsonb`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env, data }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      await ensureSchema(db);
      const rows = await db.select().from(examiners);
      // Normalise nullable JSONB fields that may be null in older rows
      const normalised = rows.map((r: any) => ({
        ...r,
        blockedPeriods: Array.isArray(r.blockedPeriods) ? r.blockedPeriods : [],
        categories: Array.isArray(r.categories) ? r.categories : [],
      }));
      return json(normalised);
    }

    if (method === 'POST') {
      if ((data as any)?.sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores', 403);
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      const newItem = await db.insert(examiners).values({ id: crypto.randomUUID(), ...body }).returning();
      return json(newItem[0]);
    }

    if (method === 'PUT') {
      if ((data as any)?.sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores', 403);
      await ensureSchema(db);
      const body = await parseBody<any>(request);
      const { id, createdAt, updatedAt, ...updates } = body;
      const updated = await db.update(examiners).set(updates).where(eq(examiners.id, id)).returning();
      return json(updated[0]);
    }

    if (method === 'DELETE') {
      if ((data as any)?.sessionUserRole !== 'ADMIN') return error('Acesso negado — apenas administradores', 403);
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
