import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(users);
      // Remove a senha do retorno por segurança
      const safeData = data.map(({ password, ...rest }) => rest);
      return res.status(200).json(safeData);
    }

    if (req.method === 'POST') {
      const body = JSON.parse(req.body);
      const newItem = await db.insert(users).values({
        id: crypto.randomUUID(),
        password: '123456', // Senha padrão se não fornecida (para usuários criados via painel)
        ...body
      }).returning();
      
      const { password, ...safeItem } = newItem[0];
      return res.status(200).json(safeItem);
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = JSON.parse(req.body);
      
      const updated = await db.update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      
      const { password, ...safeItem } = updated[0];
      return res.status(200).json(safeItem);
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