// Shared DB helper for Cloudflare Pages Functions
// Uses env.DATABASE_URL injected by the Workers runtime (no dotenv needed)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';

export function getDb(env: Record<string, string>) {
  const url = env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set in environment');
  const sqlClient = neon(url);
  return drizzle(sqlClient, { schema });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function error(message: string, status = 500): Response {
  return json({ error: message }, status);
}

export async function parseBody<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function getQuery(url: string): Record<string, string> {
  const { searchParams } = new URL(url);
  const result: Record<string, string> = {};
  searchParams.forEach((v, k) => { result[k] = v; });
  return result;
}

// ─── Audit helpers ───────────────────────────────────────────────────────────

export function extractActor(req: Request) {
  return {
    userId:   req.headers.get('X-User-Id')   ?? null,
    userName: req.headers.get('X-User-Name') ?? null,
    userRole: req.headers.get('X-User-Role') ?? null,
  };
}

let _auditTableReady = false;

export async function writeAuditLog(
  db: any,
  actor: { userId: string | null; userName: string | null; userRole: string | null },
  action: string,
  entity: string,
  entityId: string | null,
  details?: Record<string, any>
) {
  try {
    if (!_auditTableReady) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS logs_auditoria (
          id text PRIMARY KEY,
          usuario_id text,
          nome_usuario text,
          perfil_usuario text,
          acao text NOT NULL,
          entidade text NOT NULL,
          entidade_id text,
          detalhes jsonb,
          criado_em timestamp DEFAULT now()
        )
      `);
      _auditTableReady = true;
    }
    const id = crypto.randomUUID();
    const det = details ? JSON.stringify(details) : null;
    await db.execute(sql`
      INSERT INTO logs_auditoria (id, usuario_id, nome_usuario, perfil_usuario, acao, entidade, entidade_id, detalhes, criado_em)
      VALUES (
        ${id},
        ${actor.userId},
        ${actor.userName},
        ${actor.userRole},
        ${action},
        ${entity},
        ${entityId},
        ${det}::jsonb,
        now()
      )
    `);
  } catch (e) {
    console.error('[audit] write failed:', e);
  }
}
