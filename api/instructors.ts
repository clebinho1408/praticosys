import { db } from '../db/index.js';
import { instructors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(instructors);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const newItem = await db.insert(instructors).values({
        id: crypto.randomUUID(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = parseBody(req);
      const updated = await db.update(instructors)
        .set(updates)
        .where(eq(instructors.id, id))
        .returning();
      return res.status(200).json(updated[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.delete(instructors).where(eq(instructors.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}