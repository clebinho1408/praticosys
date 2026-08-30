import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// No Replit, DATABASE_URL é gerenciada pela plataforma. Quando o projeto usa
// um Neon externo, DATA_BASE_NEON mantém a prévia e o ambiente publicado na
// mesma base de dados.
const connectionString = process.env.DATA_BASE_NEON || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATA_BASE_NEON or DATABASE_URL must be set.",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
