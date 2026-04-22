
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';

const canRunDestructiveOperation = () => process.env.NODE_ENV !== 'production' || process.env.ENABLE_DESTRUCTIVE_OPERATIONS === 'true';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  if (!canRunDestructiveOperation()) {
    return res.status(403).json({ error: 'Operação desabilitada neste ambiente' });
  }

  try {
    const { action } = req.body;

    if (action === 'RESET_DATA') {
      console.log("[RiskArea] Iniciando reset de dados operacionais...");

      // Deletar dados operacionais, mantendo cadastros e configurações
      await db.execute(sql`DELETE FROM banca_results`);
      await db.execute(sql`DELETE FROM exam_requests`);
      await db.execute(sql`DELETE FROM exam_schedules`);

      console.log("[RiskArea] Dados operacionais resetados com sucesso.");

      return res.status(200).json({ 
        success: true, 
        message: 'Todos os agendamentos, escalas e resultados foram zerados com sucesso.' 
      });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error: any) {
    console.error("[RiskArea] Erro ao resetar dados:", error);
    return res.status(500).json({ error: 'Erro ao resetar dados', details: error.message });
  }
}
