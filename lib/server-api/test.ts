import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';

export default async function handler(_req: any, res: any) {
  try {
    const rawUrl = process.env.DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || "";
    
    // Mascara a URL para segurança
    const maskedUrl = rawUrl.length > 10 
        ? rawUrl.substring(0, 10) + '...' + rawUrl.substring(rawUrl.length - 5) 
        : '(vazio)';

    const envInfo = {
       hasUrl: !!rawUrl,
       urlLength: rawUrl.length,
       maskedUrl,
       nodeVersion: (process as any).version
    };

    // Verifica se o DB caiu no fallback (Mock)
    if ((db as any)._isMock) {
        return res.status(200).json({
            status: 'WARNING',
            message: 'Aplicação rodando, mas BANCO DE DADOS DESCONECTADO (Modo de Segurança Ativo).',
            detail: 'A conexão falhou na inicialização. Verifique se a variável DATABASE_URL está correta.',
            environment: envInfo
        });
    }

    // Tenta executar uma query real
    const start = Date.now();
    try {
        // Tenta query simples sem depender da tabela users
        await db.execute(sql`SELECT 1`);
    } catch (dbErr: any) {
        return res.status(200).json({
            status: 'DB_ERROR',
            message: 'Conexão inicializada, mas query falhou.',
            error: dbErr.message,
            environment: envInfo
        });
    }
    const duration = Date.now() - start;

    return res.status(200).json({
      status: 'OK',
      message: 'Sistema Operacional e Banco Conectado!',
      latency: `${duration}ms`,
      environment: envInfo
    });

  } catch (error: any) {
    // Se cair aqui, é erro de código no próprio teste
    return res.status(500).json({
      status: 'CRITICAL_ERROR',
      message: 'Erro interno no diagnóstico',
      error: error.message,
      stack: error.stack
    });
  }
}