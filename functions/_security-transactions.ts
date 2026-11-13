import { eq, sql } from 'drizzle-orm';

/** Neon HTTP and D1 batch atomically; node-postgres uses a transaction. */
export async function credentialChange(db: any, users: any, id: string, updates: any, keepToken?: string) {
  const change = (target: any) => target.update(users).set(updates).where(eq(users.id, id)).returning();
  const sessions = sql`DELETE FROM sessoes WHERE usuario_id = ${id} AND id <> ${keepToken ?? ''}`;
  const codes = sql`UPDATE codigos_otp SET usado = true WHERE usuario_id = ${id}`;
  if (typeof db.batch === 'function') {
    const result = await db.batch([change(db), db.execute(sessions), db.execute(codes)]);
    return result[0];
  }
  return db.transaction(async (tx: any) => {
    const rows = await change(tx);
    await tx.execute(sessions);
    await tx.execute(codes);
    return rows;
  });
}

export async function operationalCleanup(db: any, action: string) {
  const resetTables = ['resultados_banca', 'solicitacoes_cnhbrasil', 'solicitacoes_cfc',
    'solicitacoes_pcd', 'vagas_cfc', 'vagas_pcd', 'bancas', 'solicitacoes', 'vagas_banca'];
  const queries = action === 'RESET_DATA' ? resetTables.map(t => sql.raw(`DELETE FROM ${t}`)) :
    action === 'CLEANUP_PHANTOM_REQUESTS' ?
      ['solicitacoes_cnhbrasil', 'solicitacoes_cfc', 'solicitacoes_pcd', 'solicitacoes'].map(t =>
        sql.raw(`DELETE FROM ${t} WHERE (nome_candidato IS NULL OR nome_candidato = '' OR nome_candidato = 'Vaga Disponível') AND (cpf IS NULL OR cpf = '' OR cpf = '00000000000')`)) : null;
  if (!queries) throw new Error('Ação de limpeza inválida.');
  if (typeof db.batch === 'function') await db.batch(queries.map(q => db.execute(q)));
  else await db.transaction(async (tx: any) => { for (const q of queries) await tx.execute(q); });
  return { success: true, message: action === 'RESET_DATA' ? 'Dados operacionais apagados.' : 'Registros vazios removidos.' };
}
