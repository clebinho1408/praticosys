import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { login } = JSON.parse(req.body);
    
    // 1. Tenta encontrar o usuário
    const result = await db.select().from(users).where(eq(users.login, login));
    
    if (result.length > 0) {
      return res.status(200).json(result[0]);
    }
    
    // 2. Se não encontrou e o login for "admin", cria automaticamente (Self-Healing)
    if (login === 'admin') {
      try {
        const newAdmin = await db.insert(users).values({
          id: crypto.randomUUID(),
          name: 'Administrador',
          login: 'admin',
          role: 'ADMIN'
        }).returning();
        return res.status(200).json(newAdmin[0]);
      } catch (insertError) {
        // Caso ocorra concorrência ou erro, tenta buscar novamente
        console.error("Erro ao criar admin, tentando recuperar...", insertError);
        const retry = await db.select().from(users).where(eq(users.login, 'admin'));
        if (retry.length > 0) return res.status(200).json(retry[0]);
      }
    }

    return res.status(401).json({ error: 'Credenciais inválidas' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}