// functions/api/risk-area.ts  →  POST /api/risk-area
import { getDb, json, error, parseBody } from '../_db.js';
import { systemSettings } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const body = await parseBody<{ action: string; securityKey?: string }>(request);

    // Validate security key if one is configured
    const settingsRows = await db.select({ riskAreaKey: systemSettings.riskAreaKey })
      .from(systemSettings).where(eq(systemSettings.id, 1));
    const storedKey = settingsRows[0]?.riskAreaKey;
    if (storedKey && body.securityKey !== storedKey) {
      return error('Chave de segurança inválida. Operação bloqueada.', 403);
    }

    if (body.action === 'RESET_DATA') {
      await db.execute(sql`DELETE FROM banca_results`);
      // Novas tabelas por módulo
      await db.execute(sql`DELETE FROM cnhbrasil_requests`);
      await db.execute(sql`DELETE FROM cfc_requests`);
      await db.execute(sql`DELETE FROM pcd_requests`);
      // Slots de banca por módulo
      try { await db.execute(sql`DELETE FROM cfc_schedule_slots`); } catch {}
      try { await db.execute(sql`DELETE FROM pcd_schedule_slots`); } catch {}
      await db.execute(sql`DELETE FROM exam_schedules`);
      // Tabelas legadas (por segurança)
      try { await db.execute(sql`DELETE FROM exam_requests`); } catch {}
      try { await db.execute(sql`DELETE FROM exam_schedule_slots`); } catch {}
      return json({ success: true, message: 'Todos os agendamentos, escalas e resultados foram zerados com sucesso.' });
    }

    if (body.action === 'CLEANUP_PHANTOM_REQUESTS') {
      const phantomCondition = sql`
        (student_name IS NULL OR student_name = '' OR student_name = 'Vaga Disponível')
        AND (cpf IS NULL OR cpf = '' OR cpf = '00000000000')
      `;
      // Limpa nas 3 tabelas de módulo e na legada
      let totalCount = 0;
      for (const tableName of ['cnhbrasil_requests', 'cfc_requests', 'pcd_requests', 'exam_requests']) {
        try {
          const result = await db.execute(sql.raw(`
            DELETE FROM ${tableName}
            WHERE (student_name IS NULL OR student_name = '' OR student_name = 'Vaga Disponível')
              AND (cpf IS NULL OR cpf = '' OR cpf = '00000000000')
          `));
          totalCount += (result as any).rowCount ?? 0;
        } catch {}
      }
      return json({ success: true, message: `${totalCount} candidatos fantasma removidos do banco de dados.`, removed: totalCount });
    }

    return error('Ação não reconhecida', 400);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
