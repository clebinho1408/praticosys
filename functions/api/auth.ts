// functions/api/auth.ts  →  POST /api/auth
import { getDb, json, error, parseBody, ensurePortugueseSchema } from '../_db.js';
import { users, otpCodes } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { sendOtpEmail } from '../_resend.js';
import { createBackup } from '../_backup.js';
import { hashPassword, verifyPassword } from '../_password.js';
import { consumeAuthAttempt, invalidCredentials } from '../_auth-security.js';
import { BodyError } from '../_request-body.js';
import { issuePasswordSession, persistOtpChallenge } from '../_session-issuance.js';

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

async function hashCode(code: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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
  resendFromEmail: string | undefined,
): Promise<{ requiresOtp: true; userId: string; sentTo: string } | Response> {
  if (!resendApiKey) {
    return error('Autenticação em 2 etapas requer RESEND_API_KEY. Contate o administrador.', 503);
  }
  const rawCode = generateCode();
  const hashedCode = await hashCode(rawCode);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Invalida OTPs pendentes anteriores
  await db.execute(sql`UPDATE codigos_otp SET usado = true WHERE usuario_id = ${user.id} AND usado = false`);

  const delivery = await sendOtpEmail(resendApiKey, user.email, rawCode, 'PráticoSys', resendFromEmail);
  if (delivery.ok === false) {
    // 424 evita que a CDN troque o JSON por uma página HTML genérica de 502.
    return error(delivery.message, 424);
  }

  if (!await persistOtpChallenge(db, user, hashedCode, expiresAt)) return error(invalidCredentials, 401);

  return { requiresOtp: true, userId: user.id, sentTo: maskEmail(user.email) };
}

async function ensureSchema(db: any) {
  // Garante que todas as colunas necessárias existam (idempotente)
  const stmts = [
    sql`CREATE TABLE IF NOT EXISTS sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())`,
    sql`CREATE TABLE IF NOT EXISTS codigos_otp (id text PRIMARY KEY, usuario_id text NOT NULL, codigo text NOT NULL, expira_em timestamp NOT NULL, usado boolean DEFAULT false, tentativas_falhas integer DEFAULT 0, criado_em timestamp DEFAULT now())`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email text`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone text`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dois_fatores_ativo boolean DEFAULT false`,
    sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS forcar_troca_senha boolean DEFAULT true`,
    sql`ALTER TABLE codigos_otp ADD COLUMN IF NOT EXISTS tentativas_falhas integer DEFAULT 0`,
  ];
  for (const s of stmts) { try { await db.execute(s); } catch {} }
}

export const onRequestPost: PagesFunction<{ DATABASE_URL: string; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string }> = async (context) => {
  const { request, env } = context;
  try {
    const db = getDb(env as any);
    await ensurePortugueseSchema(db);
    await ensureSchema(db);

    const body = await parseBody<{ login: string; password: string }>(request);
    const { login, password } = body;
    if (typeof login !== 'string' || typeof password !== 'string' || !login || !password || login.length > 200 || password.length > 200) return error('Login e senha são obrigatórios', 400);
    // CF-Connecting-IP is overwritten by Cloudflare on Pages; never X-Forwarded-For.
    if (!await consumeAuthAttempt(db, request.headers.get('CF-Connecting-IP') ?? 'unknown', login)) {
      return error('Muitas tentativas. Tente novamente em até 10 minutos.', 429);
    }

    const result = await db.select().from(users).where(eq(users.login, login));
    if (result.length === 0) {
      await hashPassword(password); // comparable cost without exposing account existence
      return error(invalidCredentials, 401);
    }

    const user = result[0] as any;

    if (typeof user.password !== 'string' || !user.password.trim()) {
      await hashPassword(password);
      return error(invalidCredentials, 401);
    }

    // Verifica senha (suporta migração transparente de texto puro → bcrypt)
    if (user.password) {
      const check = await verifyPassword(password, user.password);
      if (!check.ok) return error(invalidCredentials, 401);
      if (check.needsRehash && check.hash) {
        // Re-criptografa silenciosamente (migração de senha legada)
        await db.update(users).set({ password: check.hash }).where(sql`${users.id} = ${user.id} AND ${users.password} = ${user.password}`);
        user.password = check.hash;
      }
    }

    // 2FA ativo mas sem e-mail — bloqueia para evitar bypass silencioso
    if (user.twoFactorEnabled && !user.email) {
      return error('2FA ativo sem e-mail cadastrado. Contate o administrador.', 403);
    }

    // Verificação em 2 etapas
    if (user.twoFactorEnabled && user.email) {
      const result2fa = await handle2FA(db, user, env.RESEND_API_KEY, env.RESEND_FROM_EMAIL);
      if (result2fa instanceof Response) return result2fa;
      return json(result2fa);
    }

    const sessionToken = await issuePasswordSession(db, user);
    if (!sessionToken) return error(invalidCredentials, 401);
    if (user.role === 'ADMIN') {
      // Backup automático em segundo plano no acesso do admin
      context.waitUntil(createBackup(db, 'auto').catch(() => {}));
    }
    const { password: _p, ...safe } = user as any;
    return json({ ...safe, sessionToken });
  } catch (e: any) {
    if (e instanceof BodyError) return error(e.message, e.status);
    return error('Não foi possível concluir a autenticação.', 503);
  }
};
