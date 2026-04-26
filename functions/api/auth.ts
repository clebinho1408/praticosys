// functions/api/auth.ts  →  POST /api/auth
import { getDb, json, error, parseBody } from '../_db.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const body = await parseBody<{ login: string; password: string }>(request);
    const { login, password } = body;

    if (!login || !password) return error('Login e senha são obrigatórios', 400);

    // ensure columns
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS examiner_id text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`);
    } catch {}

    const result = await db.select().from(users).where(eq(users.login, login));
    if (result.length === 0) return error('Usuário não encontrado', 401);

    const user = result[0] as any;

    // First-time admin login without password → set password
    if (login === 'admin' && !user.password) {
      const updated = await db.update(users)
        .set({ password, forcePasswordChange: false })
        .where(eq(users.id, user.id))
        .returning();
      const { password: _p, ...safe } = (updated[0] ?? user) as any;
      return json(safe);
    }

    if (user.password && user.password !== password) return error('Senha incorreta', 401);

    const { password: _p, ...safe } = user as any;
    return json(safe);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
