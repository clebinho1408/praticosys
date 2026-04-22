import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

// Gerador de ID seguro compatível com vários ambientes Node
function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    let body = req.body;

    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { login, password } = body ?? {};

    if (!login || !password) {
      return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    // Hotfix: garantir colunas necessárias
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS examiner_id text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`);
    } catch (e) {
      console.warn('[Auth API] Schema sync warning:', e);
    }

    const result = await db.select().from(users).where(eq(users.login, login));

    // Auto-criação do admin apenas se ele realmente não existir
    if (result.length === 0) {
      if (login === 'admin') {
        try {
          const newAdmin = await db
            .insert(users)
            .values({
              id: generateId(),
              name: 'Administrador',
              login: 'admin',
              password,
              role: 'ADMIN',
              forcePasswordChange: false,
            })
            .returning();

          let createdAdmin = newAdmin?.[0];

          // fallback caso o returning venha vazio
          if (!createdAdmin) {
            const fallbackAdmin = await db
              .select()
              .from(users)
              .where(eq(users.login, 'admin'));

            createdAdmin = fallbackAdmin?.[0];
          }

          if (!createdAdmin) {
            throw new Error('Admin criado mas não retornado pelo banco.');
          }

          const { password: _ignored, ...safeAdmin } = createdAdmin as any;
          return res.status(200).json(safeAdmin);
        } catch (err: any) {
          console.error('Erro ao criar admin auto:', err);
          return res.status(500).json({
            error: 'Erro ao criar admin',
            details: err.message,
          });
        }
      }

      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result[0] as any;

    // Se o admin existir mas estiver sem senha, define a senha no primeiro login
    if (login === 'admin' && !user.password) {
      const updatedAdmin = await db
        .update(users)
        .set({
          password,
          forcePasswordChange: false,
        })
        .where(eq(users.id, user.id))
        .returning();

      let adminAfterUpdate = updatedAdmin?.[0];

      if (!adminAfterUpdate) {
        const fallbackAdmin = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id));

        adminAfterUpdate = fallbackAdmin?.[0];
      }

      if (!adminAfterUpdate) {
        throw new Error('Admin atualizado mas não retornado pelo banco.');
      }

      const { password: _ignored, ...safeAdmin } = adminAfterUpdate as any;
      return res.status(200).json(safeAdmin);
    }

    if (user.password && user.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }

    const { password: _ignored, ...userWithoutPassword } = user;
    return res.status(200).json(userWithoutPassword);
  } catch (error: any) {
    console.error('CRITICAL AUTH ERROR:', error);
    return res.status(500).json({
      error: 'Erro Interno no Servidor',
      details: error.message,
    });
  }
}
