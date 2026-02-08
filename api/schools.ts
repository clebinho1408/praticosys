import { db } from '../db';
import { drivingSchools } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(drivingSchools);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = JSON.parse(req.body);
      const newItem = await db.insert(drivingSchools).values({
        id: crypto.randomUUID(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = JSON.parse(req.body);
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
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}