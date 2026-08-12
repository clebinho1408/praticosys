// functions/api/risk-area.ts  →  POST /api/risk-area
import { getDb, json, error, parseBody } from '../_db.js';
import { systemSettings } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { cpfSearchHash, validateCpfKey } from '../_cpf.js';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string; DATA_ENCRYPTION_KEY?: string }> = async ({ request, env }) => {
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
      await db.execute(sql`DELETE FROM exam_requests`);
      await db.execute(sql`DELETE FROM exam_schedules`);
      try { await db.execute(sql`DELETE FROM exam_schedule_slots`); } catch {}
      return json({ success: true, message: 'Todos os agendamentos, escalas e resultados foram zerados com sucesso.' });
    }

    if (body.action === 'CLEANUP_PHANTOM_REQUESTS') {
      // CPFs sentinela '00000000000': quando criptografia está ativa, comparar pelo cpf_hash.
      const encKey = (env as any).DATA_ENCRYPTION_KEY ?? '';
      let deleteResult: any;
      if (!validateCpfKey(encKey)) {
        const sentinelHash = await cpfSearchHash('00000000000', encKey);
        deleteResult = await db.execute(sql`
          DELETE FROM exam_requests
          WHERE (student_name IS NULL OR student_name = '' OR student_name = 'Vaga Disponível')
            AND (cpf IS NULL OR cpf = '' OR cpf_hash = ${sentinelHash})
        `);
      } else {
        // Chave não configurada: comparação em texto puro (modo degradado)
        deleteResult = await db.execute(sql`
          DELETE FROM exam_requests
          WHERE (student_name IS NULL OR student_name = '' OR student_name = 'Vaga Disponível')
            AND (cpf IS NULL OR cpf = '' OR cpf = '00000000000')
        `);
      }
      const count = (deleteResult as any).rowCount ?? 0;
      return json({ success: true, message: `${count} candidatos fantasma removidos do banco de dados.`, removed: count });
    }

    return error('Ação não reconhecida', 400);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
