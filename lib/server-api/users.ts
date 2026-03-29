
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(users);
      const safeData = data.map(({ password, ...rest }: any) => rest);
      return res.status(200).json(safeData);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);

      // Ensure columns exist (Hotfix for schema sync issues)
      try {
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id text`);
      } catch (e) {
        console.warn("[API Users] Schema sync warning:", e);
      }

      const newItem = await db.insert(users).values({
        id: crypto.randomUUID(),
        password: '123456', 
        ...body
      }).returning();
      
      const { password, ...safeItem } = newItem[0];
      return res.status(200).json(safeItem);
    }

    if (req.method === 'PUT') {
      const { id, createdAt, updatedAt, ...updates } = parseBody(req);
      
      const updated = await db.update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      
      const { password, ...safeItem } = updated[0];
      return res.status(200).json(safeItem);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.delete(users).where(eq(users.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    console.error('[API Users] Error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
