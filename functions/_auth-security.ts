import { sql } from 'drizzle-orm';
import { AUTH_SECURITY_DDL } from '../db/auth-security-migration.js';

/** Fixed windows stored in the database, not in a Worker/process. No account-wide
 * lock: an attacker on another network cannot lock the victim's account. */
export async function consumeAuthAttempt(db: any, network: string, login: unknown, purpose = 'password') {
  const window = Math.floor(Date.now() / 600_000);
  const digest = async (input: string) => Array.from(new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)),
  )).map(b => b.toString(16).padStart(2, '0')).join('');
  if (!db.$d1) await db.execute(sql.raw(AUTH_SECURITY_DDL));
  const keys: [string, number][] = [
    [await digest(`${purpose}:network:${network}`), 100],
    [await digest(`${purpose}:pair:${network}:${String(login).toLowerCase()}`), 10],
  ];
  for (const [id, maximum] of keys) {
    const result = await db.execute(sql`
      INSERT INTO limites_autenticacao (id, janela, tentativas) VALUES (${id}, ${window}, 1)
      ON CONFLICT (id) DO UPDATE SET
        tentativas = CASE WHEN limites_autenticacao.janela = ${window} THEN limites_autenticacao.tentativas + 1 ELSE 1 END,
        janela = ${window}
      RETURNING tentativas
    `);
    const rows = result.rows ?? result;
    if (Number(rows[0]?.tentativas) > maximum) return false;
  }
  await db.execute(sql`DELETE FROM limites_autenticacao WHERE janela < ${window - 2}`);
  return true;
}

export const invalidCredentials = 'Login ou senha inválidos.';
export function validPassword(value: unknown): value is string {
  // bcrypt uses at most 72 bytes. Reject rather than silently truncating.
  return typeof value === 'string' && value.trim().length >= 6 &&
    new TextEncoder().encode(value).length <= 72 && !/^\$2[aby]\$/.test(value);
}

