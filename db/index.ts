import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// 1. Tenta pegar a URL de várias fontes possíveis
const rawUrl = process.env.DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || "";

// 2. Limpeza Agressiva: 
// Remove "psql", espaços e quaisquer aspas simples ou duplas no início/fim
const cleanUrl = rawUrl
  .trim()
  .replace(/^psql\s+/, '') 
  .replace(/^['"]+|['"]+$/g, ''); // Remove ' ou " do começo e do fim

if (!cleanUrl) {
  console.error("ERRO CRÍTICO: URL do banco de dados vazia.");
} else {
  // Log de segurança (mascarado) para debug no Vercel Logs
  console.log("Database URL configurada:", cleanUrl.substring(0, 15) + "...");
}

const sql = neon(cleanUrl);
export const db = drizzle(sql, { schema });