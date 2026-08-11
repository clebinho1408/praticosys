// functions/api/verify-otp.ts  →  POST /api/verify-otp
import { getDb, json, error, parseBody } from '../_db.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { createBackup } from '../_backup.js';

const MAX_ATTEMPTS = 5;

async function hashCode(code: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSession(db: any, userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()}, now())
  `);
  return sessionId;
}

async function ensureSchema(db: any) {
  const stmts = [
    sql`CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now())`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false`,
  ];
  for (const s of stmts) { try { await db.execute(s); } catch {} }
}

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env } = context;
  try {
    const db = getDb(env as any);
    await ensureSchema(db);
    const body = await parseBody<{ userId: string; code: string }>(request);
    const { userId, code } = body;
    if (!userId || !code) return error('userId e code são obrigatórios', 400);

    const inputHash = await hashCode(code.trim());

    // Consumo atômico: UPDATE...WHERE...RETURNING (previne replay concorrente)
    const consumed = await db.execute(sql`
      UPDATE otp_codes
      SET used = true
      WHERE user_id = ${userId}
        AND code = ${inputHash}
        AND used = false
        AND expires_at > NOW()
        AND failed_attempts < ${MAX_ATTEMPTS}
      RETURNING id
    `);

    const rows = (consumed as any).rows ?? consumed;
    if (!rows || rows.length === 0) {
      // Incrementa tentativas e invalida ao atingir limite
      await db.execute(sql`
        UPDATE otp_codes
        SET
          failed_attempts = COALESCE(failed_attempts, 0) + 1,
          used = CASE
            WHEN COALESCE(failed_attempts, 0) + 1 >= ${MAX_ATTEMPTS} THEN true
            ELSE used
          END
        WHERE user_id = ${userId} AND used = false AND expires_at > NOW()
      `);
      return error('Código inválido, expirado ou tentativas esgotadas. Faça login novamente.', 401);
    }

    const result = await db.select().from(users).where(eq(users.id, userId));
    if (result.length === 0) return error('Usuário não encontrado', 404);

    const sessionToken = await createSession(db, userId);
    if ((result[0] as any).role === 'ADMIN') {
      // Backup automático em segundo plano no acesso do admin
      context.waitUntil(createBackup(db, 'auto').catch(() => {}));
    }
    const { password: _p, ...safe } = result[0] as any;
    return json({ ...safe, sessionToken });
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
