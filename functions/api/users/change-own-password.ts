// functions/api/users/change-own-password.ts
// Qualquer usuário autenticado pode alterar APENAS a própria senha.
// Usado no primeiro acesso ou após reset pelo admin (forcePasswordChange = true).
import { getDb, json, error, parseBody } from '../../_db.js';
import { users } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../_password.js';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env, data } = context as any;

  if (request.method !== 'POST') return error('Method Not Allowed', 405);

  const sessionUserId: string = data?.sessionUserId ?? '';
  if (!sessionUserId) return error('Não autenticado.', 401);

  try {
    const db = getDb(env as any);
    const body = await parseBody<{ password?: string }>(request);
    const { password } = body;

    if (!password || password.length < 6) {
      return error('A senha deve ter no mínimo 6 caracteres.', 400);
    }

    const hashed = await hashPassword(password);
    const updated = await db
      .update(users)
      .set({ password: hashed, forcePasswordChange: false })
      .where(eq(users.id, sessionUserId))
      .returning();

    if (!updated.length) return error('Usuário não encontrado.', 404);

    const { password: _p, ...safe } = updated[0] as any;
    return json(safe);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
