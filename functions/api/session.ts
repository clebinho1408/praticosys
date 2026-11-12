// Session restore is read-only; it never extends the eight-hour lifetime.
import { getDb, json, error } from '../_db.js';
import { sql } from 'drizzle-orm';
import { users } from '../../db/schema.js';
import { readSessionUser } from '../_session-user.js';

export const onRequestGet: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  const headers = { 'Cache-Control': 'no-store', Vary: 'Authorization' };
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || null;
    const user = await readSessionUser(getDb(env as any), users, token);
    const response = user ? json(user) : error('Sessão expirada ou inválida. Faça login novamente.', 401);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  } catch {
    const response = error('Não foi possível verificar sua sessão. Tente novamente.', 503);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
};

export const onRequestDelete: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      await db.execute(sql`DELETE FROM sessoes WHERE id = ${token}`);
    }
    return json({ success: true });
  } catch {
    return error('Não foi possível encerrar a sessão no servidor.', 503);
  }
};
