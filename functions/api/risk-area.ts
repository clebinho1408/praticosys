// functions/api/risk-area.ts  →  POST /api/risk-area
import { getDb, json, error, parseBody } from '../_db.js';
import { sql } from 'drizzle-orm';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const body = await parseBody<{ action: string }>(request);

    if (body.action === 'RESET_DATA') {
      await db.execute(sql`DELETE FROM banca_results`);
      await db.execute(sql`DELETE FROM exam_requests`);
      await db.execute(sql`DELETE FROM exam_schedules`);
      try { await db.execute(sql`DELETE FROM exam_schedule_slots`); } catch {}
      return json({ success: true, message: 'Todos os agendamentos, escalas e resultados foram zerados com sucesso.' });
    }

    if (body.action === 'CLEANUP_PHANTOM_REQUESTS') {
      const result = await db.execute(sql`
        DELETE FROM exam_requests
        WHERE (student_name IS NULL OR student_name = '' OR student_name = 'Vaga Disponível')
          AND (cpf IS NULL OR cpf = '' OR cpf = '00000000000')
      `);
      const count = (result as any).rowCount ?? 0;
      return json({ success: true, message: `${count} candidatos fantasma removidos do banco de dados.`, removed: count });
    }

    return error('Ação não reconhecida', 400);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
