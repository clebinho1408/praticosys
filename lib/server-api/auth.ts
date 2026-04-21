
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

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

    // Hotfix: Garantir que a coluna examiner_id existe
    try {
        const { sql } = await import('drizzle-orm');
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS examiner_id text`);
        await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`);
    } catch (e) {
        console.warn("[Auth API] Schema sync warning:", e);
    }

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
                    role: 'ADMIN',
                    forcePasswordChange: false
                }).returning();
                console.log("Admin criado com sucesso.");
                const { password: _, ...safeAdmin } = newAdmin[0];
                return res.status(200).json(safeAdmin);
            } catch (err: any) {
                console.error("Erro ao criar admin auto:", err);
                return res.status(500).json({ error: 'Erro ao criar admin', details: err.message });
            }
        }
        return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    const user = result[0];

    if (login === 'admin' && !user.password) {
        const updatedAdmin = await db.update(users).set({ password, forcePasswordChange: false }).where(eq(users.id, user.id)).returning();
        const { password: _, ...safeAdmin } = updatedAdmin[0];
        return res.status(200).json(safeAdmin);
    }

    if (user.password && user.password !== password) {
        return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    return res.status(200).json(userWithoutPassword);

  } catch (error: any) {
    console.error("CRITICAL AUTH ERROR:", error);
    return res.status(500).json({ 
        error: 'Erro Interno no Servidor', 
        details: error.message
    });
  }
}
