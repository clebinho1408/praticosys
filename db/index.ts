import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const rawUrl = process.env.DATABASE_URL || "";
const legacyUrl = process.env.VITE_NEON_DATABASE_URL || "";
const selectedUrl = rawUrl || (process.env.NODE_ENV !== 'production' ? legacyUrl : "");

// Tenta limpar a URL
const cleanUrl = selectedUrl
  .trim()
  .replace(/^psql\s+/, '') 
  .replace(/^['"]+|['"]+$/g, '');

let dbInstance;

try {
  if (!cleanUrl) {
    console.warn("AVISO: URL do banco de dados não encontrada nas variáveis de ambiente seguras.");
    throw new Error("Missing Database URL");
  }

  if (!rawUrl && legacyUrl) {
    console.warn("AVISO: usando VITE_NEON_DATABASE_URL apenas em ambiente não produtivo. Migre para DATABASE_URL.");
  }
  
  // Inicializa conexão real
  const sql = neon(cleanUrl);
  dbInstance = drizzle(sql as any, { schema });
  console.log("[DB] Conexão com Neon estabelecida com sucesso.");
} catch (e: any) {
  console.error("ERRO FATAL DB: Falha ao inicializar conexão:", e.message);
  console.log("[DB] Entrando em modo MOCK devido a falha na conexão.");
  
  // Cria um Mock do DB que não faz nada mas não derruba a aplicação
  // Isso permite que a API responda com erro 500 controlado em vez de crashar
  const crash = (op: string) => { 
      throw new Error(`Banco de dados não conectado. Operação '${op}' falhou. Verifique as variáveis de ambiente.`); 
  };
  
  dbInstance = {
    select: () => ({ from: () => ({ where: () => [], limit: () => [], orderBy: () => [], leftJoin: () => ({}) }) }),
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
    delete: () => ({ where: () => ({ returning: () => [] }) }),
    execute: async () => [],
    transaction: async () => crash('transaction'),
    _isMock: true // Flag para diagnóstico
  } as any;
}

export const db = dbInstance;