// functions/api/auth.ts  →  POST /api/auth
import { getDb, json, error, parseBody } from '../_db.js';
import { users, otpCodes } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { sendOtpEmail } from '../_resend.js';
import { createBackup } from '../_backup.js';
import { hashPassword, verifyPassword } from '../_password.js';

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

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

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Gera e envia OTP, persiste hash no banco. Retorna {requiresOtp, userId, sentTo} ou Response de erro. */
async function handle2FA(
  db: any,
  user: any,
  resendApiKey: string | undefined,
): Promise<{ requiresOtp: true; userId: string; sentTo: string } | Response> {
  if (!resendApiKey) {
    return error('Autenticação em 2 etapas requer RESEND_API_KEY. Contate o administrador.', 503);
  }
  const rawCode = generateCode();
  const hashedCode = await hashCode(rawCode);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Invalida OTPs pendentes anteriores
  await db.execute(sql`UPDATE otp_codes SET used = true WHERE user_id = ${user.id} AND used = false`);

  const emailSent = await sendOtpEmail(resendApiKey, user.email, rawCode, 'PráticoSys');
  if (!emailSent) {
    return error('Falha ao enviar o código de verificação por e-mail. Tente novamente.', 502);
  }

  await db.insert(otpCodes).values({
    id: crypto.randomUUID(),
    userId: user.id,
    code: hashedCode,
    expiresAt,
    used: false,
    failedAttempts: 0,
  });

  return { requiresOtp: true, userId: user.id, sentTo: maskEmail(user.email) };
}

async function ensureSchema(db: any) {
  // Garante que todas as colunas necessárias existam (idempotente)
  const stmts = [
    sql`CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS otp_codes (id text PRIMARY KEY, user_id text NOT NULL, code text NOT NULL, expires_at timestamp NOT NULL, used boolean DEFAULT false, failed_attempts integer DEFAULT 0, created_at timestamp DEFAULT now())`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT true`,
    sql`ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0`,
  ];
  for (const s of stmts) { try { await db.execute(s); } catch {} }
}

export const onRequestPost: PagesFunction<{ DATABASE_URL: string; RESEND_API_KEY?: string }> = async (context) => {
  const { request, env } = context;
  try {
    const db = getDb(env as any);
    await ensureSchema(db);

    const body = await parseBody<{ login: string; password: string }>(request);
    const { login, password } = body;
    if (!login || !password) return error('Login e senha são obrigatórios', 400);

    const result = await db.select().from(users).where(eq(users.login, login));
    if (result.length === 0) return error('Usuário não encontrado', 401);

    const user = result[0] as any;

    // Bootstrap admin sem senha — define senha inicial (já armazena hash)
    if (login === 'admin' && !user.password) {
      const hashed = await hashPassword(password);
      const updated = await db.update(users)
        .set({ password: hashed, forcePasswordChange: false })
        .where(eq(users.id, user.id))
        .returning();
      const u = (updated[0] ?? user) as any;

      // Mesmo no bootstrap, 2FA deve ser honrado se configurado
      if (u.twoFactorEnabled && u.email) {
        const result2fa = await handle2FA(db, u, env.RESEND_API_KEY);
        if (result2fa instanceof Response) return result2fa;
        return json(result2fa);
      }
      if (u.twoFactorEnabled && !u.email) {
        return error('2FA ativo sem e-mail cadastrado. Contate o administrador.', 403);
      }

      const sessionToken = await createSession(db, u.id);
      // Backup automático em segundo plano no acesso do admin
      context.waitUntil(createBackup(db, 'auto').catch(() => {}));
      const { password: _p, ...safe } = u;
      return json({ ...safe, sessionToken });
    }

    // Verifica senha (suporta migração transparente de texto puro → bcrypt)
    if (user.password) {
      const check = await verifyPassword(password, user.password);
      if (!check.ok) return error('Senha incorreta', 401);
      if (check.needsRehash && check.hash) {
        // Re-criptografa silenciosamente (migração de senha legada)
        await db.update(users).set({ password: check.hash }).where(eq(users.login, login));
      }
    }

    // 2FA ativo mas sem e-mail — bloqueia para evitar bypass silencioso
    if (user.twoFactorEnabled && !user.email) {
      return error('2FA ativo sem e-mail cadastrado. Contate o administrador.', 403);
    }

    // Verificação em 2 etapas
    if (user.twoFactorEnabled && user.email) {
      const result2fa = await handle2FA(db, user, env.RESEND_API_KEY);
      if (result2fa instanceof Response) return result2fa;
      return json(result2fa);
    }

    const sessionToken = await createSession(db, user.id);
    if (user.role === 'ADMIN') {
      // Backup automático em segundo plano no acesso do admin
      context.waitUntil(createBackup(db, 'auto').catch(() => {}));
    }
    const { password: _p, ...safe } = user as any;
    return json({ ...safe, sessionToken });
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
