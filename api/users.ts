import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(users);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = JSON.parse(req.body);
      const newItem = await db.insert(users).values({
        id: crypto.randomUUID(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = JSON.parse(req.body);
      const updated = await db.update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      return res.status(200).json(updated[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await db.delete(users).where(eq(users.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}