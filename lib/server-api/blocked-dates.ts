
import { db } from '../../db/index.js';
import { blockedDates } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export default async function handler(req: any, res: any) {
  const { method } = req;

  try {
    if (method === 'GET') {
      const allBlocked = await db.select().from(blockedDates).orderBy(blockedDates.date);
      return res.status(200).json(allBlocked);
    }

    if (method === 'POST') {
      const { date, description, isHoliday } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: 'Data é obrigatória' });
      }

      // Check if already exists
      const existing = await db.select().from(blockedDates).where(eq(blockedDates.date, date));
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Esta data já está bloqueada' });
      }

      const newBlocked = {
        id: randomUUID(),
        date,
        description: description || '',
        isHoliday: !!isHoliday,
        createdAt: new Date()
      };

      await db.insert(blockedDates).values(newBlocked);
      return res.status(201).json(newBlocked);
    }

    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID é obrigatório' });

      await db.delete(blockedDates).where(eq(blockedDates.id, id));
      return res.status(200).json({ success: true });
    }

    if (method === 'PUT') {
        // Bulk insert for holidays if needed, or just standard update
        const { id } = req.query;
        const updates = req.body;
        
        if (id) {
            await db.update(blockedDates).set(updates).where(eq(blockedDates.id, id));
            return res.status(200).json({ success: true });
        }
    }

    return res.status(405).send('Method Not Allowed');
  } catch (error: any) {
    console.error("[API/BlockedDates] Erro:", error);
    return res.status(500).json({ error: 'Erro no servidor', details: error.message });
  }
}
