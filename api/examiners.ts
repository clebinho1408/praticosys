import { db } from '../db';
import { examiners } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(examiners);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = JSON.parse(req.body);
      const newItem = await db.insert(examiners).values({
        id: crypto.randomUUID(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = JSON.parse(req.body);
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
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}