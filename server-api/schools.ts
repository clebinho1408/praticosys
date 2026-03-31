
import { db } from '../db/index.js';
import { drivingSchools } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'node:crypto';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      try {
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS email text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS city text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS moto_yard_address text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS car_yard_address text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS category_change_yard_address text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS main_schedule jsonb`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS provisional_schedule jsonb`);
      } catch (e) {
        console.warn("[API Schools] Schema sync warning:", e);
      }
      const data = await db.select().from(drivingSchools);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      
      // Ensure columns exist (Hotfix for schema sync issues)
      try {
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS email text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS city text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS services jsonb DEFAULT '[]'::jsonb`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS moto_yard_address text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS car_yard_address text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS category_change_yard_address text`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS main_schedule jsonb`);
        await db.execute(sql`ALTER TABLE driving_schools ADD COLUMN IF NOT EXISTS provisional_schedule jsonb`);
      } catch (e) {
        console.warn("[API Schools] Schema sync warning:", e);
      }

      const newItem = await db.insert(drivingSchools).values({
        id: crypto.randomUUID(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, createdAt, ...updates } = parseBody(req);
      const updated = await db.update(drivingSchools)
        .set(updates)
        .where(eq(drivingSchools.id, id))
        .returning();
      return res.status(200).json(updated[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.delete(drivingSchools).where(eq(drivingSchools.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    console.error('[API Schools] Error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
