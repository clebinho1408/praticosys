// functions/api/banca-results.ts  →  GET|POST /api/banca-results
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { bancaResults } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      const { scheduleId, schoolId } = query;
      let q = db.select().from(bancaResults) as any;
      if (scheduleId && schoolId) q = q.where(and(eq(bancaResults.scheduleId, scheduleId), eq(bancaResults.schoolId, schoolId)));
      else if (scheduleId) q = q.where(eq(bancaResults.scheduleId, scheduleId));
      else if (schoolId) q = q.where(eq(bancaResults.schoolId, schoolId));
      return json(await q);
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const { scheduleId, schoolId, category } = body;
      if (!scheduleId || !schoolId || !category) return error('scheduleId, schoolId e category são obrigatórios', 400);

      const existing = await db.select().from(bancaResults).where(
        and(eq(bancaResults.scheduleId, scheduleId), eq(bancaResults.schoolId, schoolId), eq(bancaResults.category, category))
      );

      if (existing.length > 0) {
        const { id, createdAt, updatedAt, ...updates } = body;
        const updated = await db.update(bancaResults).set({ ...updates, updatedAt: new Date() }).where(eq(bancaResults.id, existing[0].id)).returning();
        return json(updated[0]);
      }

      const newItem = await db.insert(bancaResults).values({ id: randomUUID(), ...body, createdAt: new Date(), updatedAt: new Date() }).returning();
      return json(newItem[0]);
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};

