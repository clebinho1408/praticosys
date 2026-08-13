// functions/api/cnh-logs.ts  →  GET /api/cnh-logs
// Retorna o log de auditoria do módulo CNH do Brasil (candidatos e bancas).
import { getDb, json, error, getQuery } from '../_db.js';
import { sql } from 'drizzle-orm';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  if (request.method !== 'GET') return error('Method Not Allowed', 405);
  try {
    const db = getDb(env as any);
    const { limit = '300', offset = '0' } = getQuery(request.url);

    // Garante tabela (idempotente)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id text PRIMARY KEY,
        user_id text,
        user_name text,
        user_role text,
        action text NOT NULL,
        entity text NOT NULL,
        entity_id text,
        details jsonb,
        created_at timestamp DEFAULT now()
      )
    `).catch(() => {});

    const rows = await db.execute(sql`
      SELECT id, user_id, user_name, user_role, action, entity, entity_id, details, created_at
      FROM audit_logs
      WHERE entity LIKE 'CNH_BRASIL%'
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `);
    return json((rows as any).rows ?? rows);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
