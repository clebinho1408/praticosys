import { db } from '../db/index.js';
import { systemSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      if (data.length === 0) {
        return res.status(200).json({
          agencyName: 'DETRAN',
          maintenanceMode: false,
          maxDailySlots: 50,
          defaultMaxSlotsA: 10,
          defaultMaxSlotsB: 10,
          minDaysForScheduling: 2
        });
      }
      return res.status(200).json(data[0]);
    }

    if (req.method === 'PUT') {
      const updates = parseBody(req);
      
      const existing = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      
      let result;
      if (existing.length === 0) {
        result = await db.insert(systemSettings).values({ id: 1, ...updates }).returning();
      } else {
        result = await db.update(systemSettings).set(updates).where(eq(systemSettings.id, 1)).returning();
      }
      
      return res.status(200).json(result[0]);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}