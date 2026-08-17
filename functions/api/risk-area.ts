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
      await db.execute(sql`DELETE FROM resultados_banca`);
      // Tabelas por módulo
      await db.execute(sql`DELETE FROM solicitacoes_cnhbrasil`);
      await db.execute(sql`DELETE FROM solicitacoes_cfc`);
      await db.execute(sql`DELETE FROM solicitacoes_pcd`);
      // Slots de banca por módulo
      try { await db.execute(sql`DELETE FROM vagas_cfc`); } catch {}
      try { await db.execute(sql`DELETE FROM vagas_pcd`); } catch {}
      await db.execute(sql`DELETE FROM bancas`);
      // Tabelas legadas (por segurança)
      try { await db.execute(sql`DELETE FROM solicitacoes`); } catch {}
      try { await db.execute(sql`DELETE FROM vagas_banca`); } catch {}
      return json({ success: true, message: 'Todos os agendamentos, escalas e resultados foram zerados com sucesso.' });
    }

    if (body.action === 'CLEANUP_PHANTOM_REQUESTS') {
      // Limpa nas 3 tabelas de módulo e na legada
      let totalCount = 0;
      for (const tableName of ['solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd', 'solicitacoes']) {
        try {
          const result = await db.execute(sql.raw(`
            DELETE FROM ${tableName}
            WHERE (nome_candidato IS NULL OR nome_candidato = '' OR nome_candidato = 'Vaga Disponível')
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
