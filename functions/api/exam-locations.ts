// functions/api/exam-locations.ts  →  GET|POST|PUT|DELETE /api/exam-locations
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { examLocations } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

async function ensureTable(db: any) {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS exam_locations (
        id text PRIMARY KEY,
        city_id text NOT NULL,
        address text,
        maps_url text,
        regions_served jsonb DEFAULT '[]'::jsonb,
        created_at timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS location_id text`);
  } catch {}
}

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    await ensureTable(db);

    if (method === 'GET') return json(await db.select().from(examLocations));

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      if (!body.cityId) return error('cityId é obrigatório', 400);
      const newLocation = {
        id: crypto.randomUUID(),
        cityId: body.cityId,
        address: body.address || null,
        mapsUrl: body.mapsUrl || null,
        regionsServed: body.regionsServed || [],
        createdAt: new Date(),
      };
      await db.insert(examLocations).values(newLocation);
      return json(newLocation, 201);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const id = body.id || query.id;
      if (!id) return error('ID obrigatório', 400);
      const { id: _id, createdAt, ...updates } = body;
      await db.update(examLocations).set(updates).where(eq(examLocations.id, id));
      return json({ id, ...updates });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(examLocations).where(eq(examLocations.id, id));
      return new Response(null, { status: 204 });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
