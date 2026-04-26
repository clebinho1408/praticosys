// functions/api/risk-area.ts  →  POST /api/risk-area
import { getDb, json, error, parseBody } from '../_db.js';
import { sql } from 'drizzle-orm';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const body = await parseBody<{ action: string }>(request);
    if (body.action !== 'RESET_DATA') return error('Ação inválida', 400);

    await db.execute(sql`DELETE FROM banca_results`);
    await db.execute(sql`DELETE FROM exam_requests`);
    await db.execute(sql`DELETE FROM exam_schedules`);

    return json({ success: true, message: 'Todos os agendamentos, escalas e resultados foram zerados com sucesso.' });
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};

