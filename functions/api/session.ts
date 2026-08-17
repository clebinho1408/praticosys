// functions/api/session.ts  →  DELETE /api/session  (logout)
import { getDb, json } from '../_db.js';
import { sql } from 'drizzle-orm';

export const onRequestDelete: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      await db.execute(sql`DELETE FROM sessoes WHERE id = ${token}`);
    }
    return json({ success: true });
  } catch {
    return json({ success: true }); // falha silenciosa — o cliente já limpou localStorage
  }
};
