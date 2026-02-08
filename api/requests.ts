import { db } from '../db/index.js';
import { examRequests } from '../db/schema.js';
import { eq, like, or } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

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
        id: crypto.randomUUID(),
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
  }
}