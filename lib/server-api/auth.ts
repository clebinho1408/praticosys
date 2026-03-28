
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

// Gerador de ID seguro compatível com vários ambientes Node
function generateId() {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { login, password } = body;
    
    console.log(`Tentativa de login para: ${login}`);

    const result = await db.select().from(users).where(eq(users.login, login));
    
    if (result.length === 0) {
        if (login === 'admin') {
            try {
                console.log("Usuário admin não encontrado. Criando automaticamente...");
                const newAdmin = await db.insert(users).values({
                    id: generateId(),
                    name: 'Administrador',
                    login: 'admin',
                    password: password, 
                    role: 'ADMIN'
                }).returning();
                console.log("Admin criado com sucesso.");
                return res.status(200).json(newAdmin[0]);
            } catch (err: any) {
                console.error("Erro ao criar admin auto:", err);
                return res.status(500).json({ error: 'Erro ao criar admin', details: err.message });
            }
        }
        return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    const user = result[0];

    if (login === 'admin' && !user.password) {
        await db.update(users).set({ password }).where(eq(users.id, user.id));
        return res.status(200).json(user);
    }

    if (user.password && user.password !== password) {
        return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    return res.status(200).json(user);

  } catch (error: any) {
    console.error("CRITICAL AUTH ERROR:", error);
    return res.status(500).json({ 
        error: 'Erro Interno no Servidor', 
        details: error.message
    });
  }
}
