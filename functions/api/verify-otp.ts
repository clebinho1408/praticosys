// functions/api/verify-otp.ts  →  POST /api/verify-otp
import { getDb, json, error, parseBody, ensurePortugueseSchema } from '../_db.js';
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
    INSERT INTO sessoes (id, usuario_id, expira_em, criado_em)
    VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()}, now())
  `);
  return sessionId;
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
    if (!userId || !code) return error('userId e code são obrigatórios', 400);

    const inputHash = await hashCode(code.trim());

    // Consumo atômico: UPDATE...WHERE...RETURNING (previne replay concorrente)
    const consumed = await db.execute(sql`
      UPDATE codigos_otp
      SET usado = true
      WHERE usuario_id = ${userId}
        AND codigo = ${inputHash}
        AND usado = false
        AND expira_em > NOW()
        AND tentativas_falhas < ${MAX_ATTEMPTS}
      RETURNING id
    `);

    const rows = (consumed as any).rows ?? consumed;
    if (!rows || rows.length === 0) {
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
