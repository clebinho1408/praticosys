import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { login } = JSON.parse(req.body);
    
    // Busca usuário no banco
    const result = await db.select().from(users).where(eq(users.login, login));
    
    if (result.length > 0) {
      return res.status(200).json(result[0]);
    }
    
    // Fallback temporário para criar admin se não existir ninguém (para primeiro acesso)
    if (login === 'admin') {
      const allUsers = await db.select().from(users);
      if (allUsers.length === 0) {
        const newAdmin = await db.insert(users).values({
          id: crypto.randomUUID(),
          name: 'Administrador',
          login: 'admin',
          role: 'ADMIN'
        }).returning();
        return res.status(200).json(newAdmin[0]);
      }
    }

    return res.status(401).json({ error: 'Credenciais inválidas' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}