import { db } from '../db';
import { systemSettings } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      if (data.length === 0) {
        // Retorna padrão se vazio
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
      const updates = JSON.parse(req.body);
      
      // Upsert (Update or Insert)
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