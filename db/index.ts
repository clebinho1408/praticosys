import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// A variável de ambiente DATABASE_URL virá da Vercel/Neon
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });