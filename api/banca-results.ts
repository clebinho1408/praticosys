
// Banca Results API Handler
import { db } from '../db/index.js';
import { bancaResults } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

const parseBody = (req: any) => {
    try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return req.body;
    }
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const { scheduleId, schoolId } = req.query;
      let query = db.select().from(bancaResults);
      
      if (scheduleId && schoolId) {
        // @ts-ignore
        query = query.where(and(eq(bancaResults.scheduleId, scheduleId), eq(bancaResults.schoolId, schoolId)));
      } else if (scheduleId) {
        // @ts-ignore
        query = query.where(eq(bancaResults.scheduleId, scheduleId));
      } else if (schoolId) {
        // @ts-ignore
        query = query.where(eq(bancaResults.schoolId, schoolId));
      }
      
      const data = await query;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const { scheduleId, schoolId, category } = body;
      
      if (!scheduleId || !schoolId || !category) {
        return res.status(400).json({ error: 'scheduleId, schoolId and category are required' });
      }

      // Check if already exists
      const existing = await db.select().from(bancaResults).where(
        and(
          eq(bancaResults.scheduleId, scheduleId),
          eq(bancaResults.schoolId, schoolId),
          eq(bancaResults.category, category)
        )
      );

      if (existing.length > 0) {
        // Update
        const { id, createdAt, updatedAt, ...updates } = body;
        const updated = await db.update(bancaResults)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(bancaResults.id, existing[0].id))
          .returning();
        return res.status(200).json(updated[0]);
      } else {
        // Insert
        const newItem = await db.insert(bancaResults).values({
          id: crypto.randomUUID(),
          ...body,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        return res.status(200).json(newItem[0]);
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error("[API/BancaResults] Error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
