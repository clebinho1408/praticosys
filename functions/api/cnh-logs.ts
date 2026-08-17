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
      CREATE TABLE IF NOT EXISTS logs_auditoria (
        id text PRIMARY KEY,
        usuario_id text,
        nome_usuario text,
        perfil_usuario text,
        acao text NOT NULL,
        entidade text NOT NULL,
        entidade_id text,
        detalhes jsonb,
        criado_em timestamp DEFAULT now()
      )
    `).catch(() => {});

    const rows = await db.execute(sql`
      SELECT id, usuario_id AS user_id, nome_usuario AS user_name, perfil_usuario AS user_role,
             acao AS action, entidade AS entity, entidade_id AS entity_id,
             detalhes AS details, criado_em AS created_at
      FROM logs_auditoria
      WHERE entidade LIKE 'CNH_BRASIL%'
      ORDER BY criado_em DESC
      LIMIT ${parseInt(limit)}
      OFFSET ${parseInt(offset)}
    `);
    return json((rows as any).rows ?? rows);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
