import { db } from '../db/index.js';
import { examRequests } from '../db/schema.js';
import { eq, like, or } from 'drizzle-orm';

const parseBody = (req: any) => {
    try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return req.body;
    }
};

export default async function handler(req: any, res: any) {
  try {
    console.log(`[API/Requests] Recebendo requisição: ${req.method}`);
    
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
      console.log("[API/Requests] Criando novo candidato:", body.studentName);
      
      const newItem = await db.insert(examRequests).values({
        id: body.id || crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...body
      }).returning();
      
      console.log("[API/Requests] Candidato salvo com sucesso no banco!");
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = parseBody(req);
      console.log(`[API/Requests] Atualizando candidato ID: ${id}`);
      
      const updated = await db.update(examRequests)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(examRequests.id, id))
        .returning();
      
      return res.status(200).json(updated[0]);
    }
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error("[API/Requests] CRITICAL ERROR:", error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}