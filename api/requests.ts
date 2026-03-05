
// Requests API Handler
import { db } from '../db/index.js';
import { examRequests } from '../db/schema.js';
import { eq, like } from 'drizzle-orm';
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
      const { cpf } = req.query;
      if (cpf) {
         const cleanCpf = cpf.replace(/\D/g, '');
         const data = await db.select().from(examRequests).where(like(examRequests.cpf, `%${cleanCpf}%`));
         return res.status(200).json(data);
      }
      const data = await db.select().from(examRequests);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const newItem = await db.insert(examRequests).values({
        id: body.id || crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = parseBody(req);
      const updated = await db.update(examRequests)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(examRequests.id, id))
        .returning();
      return res.status(200).json(updated[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      await db.delete(examRequests).where(eq(examRequests.id, id));
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error("[API/Requests] Error:", error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
