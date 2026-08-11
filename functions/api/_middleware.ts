// functions/api/_middleware.ts — valida sessão e injeta userId/role em context.data
import { getDb, error } from '../_db.js';
import { sql } from 'drizzle-orm';

const PUBLIC_PATHS = [
  '/api/auth',
  '/api/verify-otp',
  '/api/setup',
  '/api/health',
  '/api/test',
  '/api/session',
];

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env, next, data } = context as any;
  const url = new URL(request.url);

  // Rotas públicas passam direto
  if (PUBLIC_PATHS.some(p => url.pathname === p)) {
    return next();
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return error('Não autenticado. Faça login novamente.', 401);
  }

  try {
    const db = getDb(env as any);
    // Garante que sessions existe antes de consultar (idempotente)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, user_id text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp DEFAULT now())`).catch(() => {});
    const rows = await db.execute(sql`
      SELECT u.id, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ${token} AND s.expires_at > NOW()
      LIMIT 1
    `);
    const rowData = (rows as any).rows ?? rows;
    if (!rowData || rowData.length === 0) {
      return error('Sessão expirada ou inválida. Faça login novamente.', 401);
    }
    // Injeta identidade do usuário para as rotas filhas usarem
    data.sessionUserId = rowData[0].id;
    data.sessionUserRole = rowData[0].role;
    return next();
  } catch (e: any) {
    return error('Erro ao verificar sessão: ' + e.message, 500);
  }
};
