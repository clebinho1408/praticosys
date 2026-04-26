// functions/api/blocked-dates.ts  →  GET|POST|PUT|DELETE /api/blocked-dates
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { blockedDates } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') return json(await db.select().from(blockedDates).orderBy(blockedDates.date));

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      if (!body.date) return error('Data é obrigatória', 400);
      const existing = await db.select().from(blockedDates).where(eq(blockedDates.date, body.date));
      if (existing.length > 0) return error('Esta data já está bloqueada', 400);
      const newRow = { id: randomUUID(), date: body.date, description: body.description || '', isHoliday: !!body.isHoliday, createdAt: new Date() };
      await db.insert(blockedDates).values(newRow);
      return json(newRow, 201);
    }

    if (method === 'PUT') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      const body = await parseBody<any>(request);
      await db.update(blockedDates).set(body).where(eq(blockedDates.id, id));
      return json({ success: true });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(blockedDates).where(eq(blockedDates.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};

