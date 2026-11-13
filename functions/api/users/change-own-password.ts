// functions/api/users/change-own-password.ts
// Qualquer usuário autenticado pode alterar APENAS a própria senha.
// Usado no primeiro acesso ou após reset pelo admin (forcePasswordChange = true).
import { getDb, json, error, parseBody } from '../../_db.js';
import { users } from '../../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../../_password.js';
import { validPassword, consumeAuthAttempt } from '../../_auth-security.js';
import { credentialChange } from '../../_security-transactions.js';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env, data } = context as any;

  if (request.method !== 'POST') return error('Method Not Allowed', 405);

  const sessionUserId: string = data?.sessionUserId ?? '';
  if (!sessionUserId) return error('Não autenticado.', 401);

  try {
    const db = getDb(env as any);
    const body = await parseBody<{ password?: string; currentPassword?: string; confirmSessionRevocation?: boolean }>(request);
    const { password } = body;

    if (!validPassword(password)) {
      return error('A senha deve ter no mínimo 6 caracteres.', 400);
    }
    if (body.confirmSessionRevocation !== true) return error('Confirme o encerramento dos outros acessos; este aparelho continuará conectado.', 409);
    if (!await consumeAuthAttempt(db, request.headers.get('CF-Connecting-IP') ?? 'unknown', sessionUserId, 'credential-change')) {
      return error('Muitas tentativas. Tente novamente em até 10 minutos.', 429);
    }
    const [current] = await db.select().from(users).where(eq(users.id, sessionUserId)).limit(1);
    if (!current) return error('Usuário não encontrado.', 404);
    if (!current.forcePasswordChange && (typeof body.currentPassword !== 'string' ||
      !(await verifyPassword(body.currentPassword, current.password ?? '')).ok)) return error('Senha atual inválida.', 403);

    const hashed = await hashPassword(password);
    const token = request.headers.get('Authorization')?.slice(7).trim() ?? '';
    const updated = await credentialChange(db, users, sessionUserId, { password: hashed, forcePasswordChange: false }, token);

    if (!updated.length) return error('Usuário não encontrado.', 404);

    const { password: _p, ...safe } = updated[0] as any;
    return json(safe);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
