// functions/api/backups.ts  →  GET|POST /api/backups (somente ADMIN)
import { getDb, json, error, getQuery } from '../_db.js';
import { createBackup, ensureBackupSchema } from '../_backup.js';
import { sql } from 'drizzle-orm';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async (context) => {
  const { request, env, data } = context as any;
  if (data?.sessionUserRole !== 'ADMIN') {
    return error('Acesso negado — apenas administradores', 403);
  }

  try {
    const db = getDb(env as any);
    await ensureBackupSchema(db);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      if (query.id) {
        // Download: retorna o payload completo do backup
        const res = await db.execute(sql`SELECT id, payload, created_at FROM backups WHERE id = ${query.id} LIMIT 1`);
        const rows = (res as any).rows ?? res;
        if (!rows || rows.length === 0) return error('Backup não encontrado', 404);
        return json(rows[0]);
      }
      // Lista (sem payload)
      const res = await db.execute(sql`
        SELECT id, trigger_type, size_bytes, created_at FROM backups ORDER BY created_at DESC
      `);
      return json((res as any).rows ?? res);
    }

    if (method === 'POST') {
      const result = await createBackup(db, 'manual');
      return json({ success: true, ...result });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
