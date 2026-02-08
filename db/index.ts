import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// 1. Tenta pegar a URL de várias fontes possíveis (Vercel ou Vite)
const rawUrl = process.env.DATABASE_URL || process.env.VITE_NEON_DATABASE_URL || "";

// 2. Limpeza Robusta: Remove prefixo "psql", aspas simples/duplas e espaços
// Isso corrige o erro comum de copiar o comando inteiro do painel da Neon
const cleanUrl = rawUrl
  .replace(/^psql\s+/, '') // Remove "psql " do início se houver
  .replace(/^'|'$/g, '')   // Remove aspas simples do início/fim
  .replace(/^"|"$/g, '')   // Remove aspas duplas do início/fim
  .trim();

if (!cleanUrl) {
  console.error("ERRO CRÍTICO: URL do banco de dados vazia ou inválida.");
}

const sql = neon(cleanUrl);
export const db = drizzle(sql, { schema });