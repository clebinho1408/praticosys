import { sql } from 'drizzle-orm';
import { isD1 } from './_d1.js';

const rows = (result: any): any[] => result?.rows ?? result ?? [];
const lock = (db: any) => isD1(db) ? sql`` : sql`FOR UPDATE`;
const expiry = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

/** Lock the same user row changed by credentialChange. A login verified before
 * a concurrent password reset must not mint a session after its revocations. */
export async function issuePasswordSession(db: any, user: any): Promise<string | null> {
  const token = crypto.randomUUID();
  const inserted = await db.execute(sql`
    INSERT INTO sessoes (id, usuario_id, expira_em, criado_em)
    SELECT ${token}, id, ${expiry()}, NOW() FROM usuarios
    WHERE id = ${user.id} AND senha = ${user.password} AND senha <> ''
    ${lock(db)} RETURNING id
  `);
  return rows(inserted).length ? token : null;
}

export async function persistOtpChallenge(db: any, user: any, codeHash: string, expiresAt: Date) {
  const inserted = await db.execute(sql`
    INSERT INTO codigos_otp (id, usuario_id, codigo, expira_em, usado, tentativas_falhas)
    SELECT ${crypto.randomUUID()}, id, ${codeHash}, ${expiresAt.toISOString()}, false, 0
    FROM usuarios WHERE id = ${user.id} AND senha = ${user.password} AND senha <> ''
    ${lock(db)} RETURNING id
  `);
  return rows(inserted).length > 0;
}

/** Token insertion and OTP consumption are one transaction, serialized against
 * reset on PostgreSQL by row locks, and by the atomic batch on D1. */
export async function consumeOtpSession(db: any, user: any, codeHash: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const queries = [
    sql`INSERT INTO sessoes (id, usuario_id, expira_em, criado_em)
      SELECT ${token}, u.id, ${expiry()}, NOW() FROM usuarios u JOIN codigos_otp o ON o.usuario_id = u.id
      WHERE u.id = ${user.id} AND u.senha = ${user.password} AND u.senha <> ''
        AND o.codigo = ${codeHash} AND o.usado = false AND o.expira_em > NOW() AND o.tentativas_falhas < 5
      LIMIT 1 ${lock(db)} RETURNING id`,
    sql`UPDATE codigos_otp SET usado = true WHERE usuario_id = ${user.id} AND codigo = ${codeHash}
      AND EXISTS (SELECT 1 FROM sessoes WHERE id = ${token})`,
  ];
  const results = typeof db.batch === 'function'
    ? await db.batch(queries.map(q => db.execute(q)))
    : await db.transaction(async (tx: any) => {
      const result = [];
      for (const q of queries) result.push(await tx.execute(q));
      return result;
    });
  return rows(results[0]).length ? token : null;
}
