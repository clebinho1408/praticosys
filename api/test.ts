import { db } from '../db';
import { sql } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = process.env.DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || "";
    
    // Limpeza para visualização (mascarada)
    const cleanUrl = rawUrl
      .trim()
      .replace(/^psql\s+/, '')
      .replace(/^['"]+|['"]+$/g, '');

    const maskedUrl = cleanUrl.replace(/:([^:@]+)@/, ':****@');

    // Teste 1: Informações do Ambiente
    const envInfo = {
       hasUrl: !!rawUrl,
       urlLength: rawUrl.length,
       cleanUrlPreview: maskedUrl,
       nodeVersion: (process as any).version
    };

    // Teste 2: Conexão Simples com o Banco
    const start = Date.now();
    try {
        await db.execute(sql`SELECT 1`);
    } catch (dbErr: any) {
        throw new Error(`Falha na conexão DB: ${dbErr.message}`);
    }
    const duration = Date.now() - start;

    return res.status(200).json({
      status: 'OK',
      message: 'Sistema Operacional e Banco Conectado!',
      latency: `${duration}ms`,
      environment: envInfo
    });

  } catch (error: any) {
    console.error("DIAGNOSTIC ERROR:", error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Diagnóstico falhou',
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    });
  }
}