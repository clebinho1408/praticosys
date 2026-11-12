import { sql } from 'drizzle-orm';
import { GetSessionResponse } from '../lib/api-zod/src/generated/api.js';

/** Both runtimes use the server's current identity, never X-User-* or stored roles. */
export async function readSessionUser(db: any, users: any, token: string | null) {
  if (!token) return null;
  const rows = await db.select().from(users).where(sql`
    ${users.id} IN (
      SELECT usuario_id FROM sessoes WHERE id = ${token} AND expira_em > NOW()
    )
  `).limit(1);
  if (!rows.length) return null;
  // Generated schema is an allowlist: passwords, tokens and future private fields
  // cannot accidentally become part of the session-restoration response.
  return GetSessionResponse.parse(Object.fromEntries(
    Object.entries(rows[0]).filter(([, value]) => value != null),
  ));
}
