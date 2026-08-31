// functions/api/backups.ts  →  GET|POST /api/backups (somente ADMIN)
import { getDb, json, error, getQuery, parseBody } from '../_db.js';
import { createBackup, ensureBackupSchema, restoreBackup } from '../_backup.js';
import { sql } from 'drizzle-orm';
import * as schema from '../../db/schema.js';

const RESTORE_SCHEMA_TABLES = {
  autoescolas: schema.drivingSchools,
  examinadores: schema.examiners,
  instrutores: schema.instructors,
  veiculos: schema.vehicles,
  cidades: schema.cities,
  bancas: schema.examSchedules,
  solicitacoes: schema.examRequests,
  solicitacoes_cnhbrasil: schema.cnhbrasilRequests,
  solicitacoes_cfc: schema.cfcRequests,
  solicitacoes_pcd: schema.pcdRequests,
  vagas_banca: schema.examScheduleSlots,
  vagas_cfc: schema.cfcScheduleSlots,
  vagas_pcd: schema.pcdScheduleSlots,
  resultados_banca: schema.bancaResults,
  locais_exame: schema.examLocations,
  datas_bloqueadas: schema.blockedDates,
  configuracoes: schema.systemSettings,
  usuarios: schema.users,
};

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
        const res = await db.execute(sql`SELECT id, dados AS payload, criado_em AS created_at FROM backups WHERE id = ${query.id} LIMIT 1`);
        const rows = (res as any).rows ?? res;
        if (!rows || rows.length === 0) return error('Backup não encontrado', 404);
        return json(rows[0]);
      }
      // Lista (sem payload)
      const res = await db.execute(sql`
        SELECT id, tipo_gatilho AS trigger_type, tamanho_bytes AS size_bytes, criado_em AS created_at FROM backups ORDER BY criado_em DESC
      `);
      return json((res as any).rows ?? res);
    }

    if (method === 'POST') {
      const body = await parseBody<{ payload?: unknown; backupId?: string }>(request);
      if (body.payload !== undefined || body.backupId) {
        let payload = body.payload;
        if (body.backupId) {
          const stored = await db.execute(sql`SELECT dados AS payload FROM backups WHERE id = ${body.backupId} LIMIT 1`);
          const storedRows = (stored as any).rows ?? stored;
          if (!storedRows || storedRows.length === 0) return error('Backup não encontrado', 404);
          payload = storedRows[0].payload;
        }
        const result = await restoreBackup(db, payload, { batchTables: RESTORE_SCHEMA_TABLES });
        return json({ success: true, ...result });
      }
      const result = await createBackup(db, 'manual');
      return json({ success: true, ...result });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
