import { db } from '../db';
import { examRequests } from '../db/schema';
import { eq, like, or } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const { cpf } = req.query;
      
      if (cpf) {
         // Busca específica por CPF (limpa caracteres não numéricos)
         const cleanCpf = cpf.replace(/\D/g, '');
         // Nota: Aqui assumimos que o banco guarda com pontuação. 
         // Se guardar limpo, precisa ajustar. O ideal é usar LIKE.
         const data = await db.select().from(examRequests).where(like(examRequests.cpf, `%${cleanCpf}%`)); // Simplificação
         return res.status(200).json(data);
      }
      
      const data = await db.select().from(examRequests);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = JSON.parse(req.body);
      const newItem = await db.insert(examRequests).values({
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = JSON.parse(req.body);
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