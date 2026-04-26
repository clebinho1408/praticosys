// functions/api/cities.ts  →  GET|POST|PUT|DELETE /api/cities
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { cities } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') return json(await db.select().from(cities));

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      if (!body.name) return error('Nome é obrigatório', 400);
      const normalized = body.name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const newCity = { id: randomUUID(), name: normalized, createdAt: new Date() };
      await db.insert(cities).values(newCity);
      return json(newCity, 201);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const id = body.id || query.id;
      if (!id) return error('ID obrigatório', 400);
      const updates: any = {};
      if (body.name) updates.name = body.name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      await db.update(cities).set(updates).where(eq(cities.id, id));
      return json({ id, ...updates });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(cities).where(eq(cities.id, id));
      return new Response(null, { status: 204 });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};

