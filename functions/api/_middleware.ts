// functions/api/_middleware.ts — valida sessão e injeta userId/role em context.data
import { getDb, error, ensureCnhBrasilSdcStorage, ensurePortugueseSchema, ensureColumnMigrations } from '../_db.js';
import { sql } from 'drizzle-orm';
import * as schema from '../../db/schema.js';
import { readSessionUser } from '../_session-user.js';
import { accessPolicy, sanitizeMutation, AccessDenied } from '../_access-policy.js';
import { readJsonBody, BodyError } from '../_request-body.js';

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
    // Garante todas as colunas adicionadas após o schema inicial
    await ensureColumnMigrations(db);
    // SDC é um dado do exame de categoria B também no módulo CNH do Brasil.
    await ensureCnhBrasilSdcStorage(db);
    // Garante que sessoes existe antes de consultar (idempotente)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS sessoes (id text PRIMARY KEY, usuario_id text NOT NULL, expira_em timestamp NOT NULL, criado_em timestamp DEFAULT now())`).catch(() => {});
    const user = await readSessionUser(db, schema.users, token);
    if (!user) {
      return error('Sessão expirada ou inválida. Faça login novamente.', 401);
    }
    // Injeta identidade do usuário para as rotas filhas usarem
    data.sessionUserId = user.id;
    data.sessionUserRole = user.role;
    data.sessionUser = user;
    const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ?
      await readJsonBody(request.clone(), route === 'backups' ? 8_500_000 : 131_072) : {};
    const policy = await accessPolicy(db, schema, user);
    await policy.authorize(route, request.method, body, Object.fromEntries(url.searchParams));
    data.authorizedRoute = route;
    const response = ['POST', 'PUT', 'PATCH'].includes(request.method)
      ? await next(new Request(request, { body: JSON.stringify(sanitizeMutation(route, body, schema)) }))
      : await next();
    if (response.status >= 500) return error('Não foi possível concluir a operação.', response.status);
    if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return response;
    const payload = await response.json();
    return new Response(JSON.stringify(await policy.project(payload, route)), {
      status: response.status, headers: { ...Object.fromEntries(response.headers), 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    if (e instanceof AccessDenied) return error(e.message, e.status);
    if (e instanceof BodyError) return error(e.message, e.status);
    return error('Não foi possível verificar as permissões. Tente novamente.', 503);
  }
};
