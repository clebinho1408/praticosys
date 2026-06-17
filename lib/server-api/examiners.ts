
import { db } from '../../db/index.js';
import { examiners } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      try {
        console.log("[API Examiners] Executando ALTER TABLE...");
        await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb`);
        await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS default_max_slots_a integer`);
        await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS default_max_slots_b integer`);
        console.log("[API Examiners] ALTER TABLE executado.");
      } catch (e) {
        console.error("[API Examiners] Schema sync error:", e);
      }
      console.log("[API Examiners] Executando SELECT...");
      const data = await db.select().from(examiners);
      console.log("[API Examiners] SELECT executado.");
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      
      try {
        await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb`);
        await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS default_max_slots_a integer`);
        await db.execute(sql`ALTER TABLE public.examiners ADD COLUMN IF NOT EXISTS default_max_slots_b integer`);
      } catch (e) {
        console.warn("[API Examiners] Schema sync warning:", e);
      }

      const newItem = await db.insert(examiners).values({
        id: crypto.randomUUID(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, createdAt, updatedAt, ...updates } = parseBody(req);
      const updated = await db.update(examiners)
        .set(updates)
        .where(eq(examiners.id, id))
        .returning();
      return res.status(200).json(updated[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.delete(examiners).where(eq(examiners.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    console.error('[API Examiners] Error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
