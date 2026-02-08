import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // Parsing Seguro: Se já for objeto, usa direto. Se for string, converte.
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { login, password } = body;
    
    // 1. Tenta encontrar o usuário
    const result = await db.select().from(users).where(eq(users.login, login));
    
    // Se o usuário não existe e é 'admin', cria automaticamente
    if (result.length === 0) {
        if (login === 'admin') {
            try {
                const newAdmin = await db.insert(users).values({
                    id: crypto.randomUUID(),
                    name: 'Administrador',
                    login: 'admin',
                    password: password, 
                    role: 'ADMIN'
                }).returning();
                return res.status(200).json(newAdmin[0]);
            } catch (err) {
                console.error("Erro ao criar admin auto:", err);
                return res.status(500).json({ error: 'Erro ao criar admin' });
            }
        }
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const user = result[0];

    // Se o usuário existe, mas a senha está NULL no banco (migração antiga)
    if (login === 'admin' && !user.password) {
        await db.update(users).set({ password }).where(eq(users.id, user.id));
        return res.status(200).json(user);
    }

    if (user.password && user.password !== password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    return res.status(200).json(user);

  } catch (error: any) {
    console.error("AUTH ERROR:", error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}