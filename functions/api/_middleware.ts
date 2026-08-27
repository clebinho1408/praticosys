// functions/api/_middleware.ts — valida sessão e injeta userId/role em context.data
import { getDb, error, ensureCnhBrasilSdcStorage, ensurePortugueseSchema } from '../_db.js';
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
    // Garante schema em português (roda a migração de renomeação na 1ª requisição)
    await ensurePortugueseSchema(db);
    // SDC é um dado do exame de categoria B também no módulo CNH do Brasil.
    await ensureCnhBrasilSdcStorage(db);
    // Garante que sessoes existe antes de consultar (idempotente)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())`).catch(() => {});
    const rows = await db.execute(sql`
      SELECT u.id, u.perfil AS role
      FROM sessoes s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id = ${token} AND s.expira_em > NOW()
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
