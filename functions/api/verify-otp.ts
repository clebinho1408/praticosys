// functions/api/verify-otp.ts  →  POST /api/verify-otp
import { getDb, json, error, parseBody, ensurePortugueseSchema } from '../_db.js';
import { users } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { createBackup } from '../_backup.js';
import { consumeAuthAttempt } from '../_auth-security.js';
import { BodyError } from '../_request-body.js';
import { consumeOtpSession } from '../_session-issuance.js';

const MAX_ATTEMPTS = 5;

async function hashCode(code: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureSchema(db: any) {
  const stmts = [
    sql`CREATE TABLE IF NOT EXISTS sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_ativo boolean DEFAULT false`,
  ];
  for (const s of stmts) { try { await db.execute(s); } catch {} }
}

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env } = context;
  try {
    const db = getDb(env as any);
    await ensurePortugueseSchema(db);
    await ensureSchema(db);
    const body = await parseBody<{ userId: string; code: string }>(request);
    const { userId, code } = body;
    if (typeof userId !== 'string' || typeof code !== 'string' || !userId || !/^\d{6}$/.test(code)) return error('userId e code são obrigatórios', 400);
    if (!await consumeAuthAttempt(db, request.headers.get('CF-Connecting-IP') ?? 'unknown', userId, 'otp')) return error('Muitas tentativas. Tente novamente em até 10 minutos.', 429);

    const inputHash = await hashCode(code.trim());

    const result = await db.select().from(users).where(eq(users.id, userId));
    const sessionToken = result.length ? await consumeOtpSession(db, result[0], inputHash) : null;
    if (!sessionToken) {
      // Incrementa tentativas e invalida ao atingir limite
      await db.execute(sql`
        UPDATE codigos_otp
        SET
          tentativas_falhas = COALESCE(tentativas_falhas, 0) + 1,
          usado = CASE
            WHEN COALESCE(tentativas_falhas, 0) + 1 >= ${MAX_ATTEMPTS} THEN true
            ELSE usado
          END
        WHERE usuario_id = ${userId} AND usado = false AND expira_em > NOW()
      `);
      return error('Código inválido, expirado ou tentativas esgotadas. Faça login novamente.', 401);
    }

    if ((result[0] as any).role === 'ADMIN') {
      // Backup automático em segundo plano no acesso do admin
      context.waitUntil(createBackup(db, 'auto').catch(() => {}));
    }
    const { password: _p, ...safe } = result[0] as any;
    return json({ ...safe, sessionToken });
  } catch (e: any) {
    if (e instanceof BodyError) return error(e.message, e.status);
    return error('Não foi possível concluir a autenticação.', 503);
  }
};
