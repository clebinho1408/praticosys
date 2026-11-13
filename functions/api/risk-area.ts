import { getDb, json, error, parseBody } from '../_db.js';
import { systemSettings } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { operationalCleanup } from '../_security-transactions.js';

export const onRequestPost: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env, data }) => {
  if (data?.sessionUserRole !== 'ADMIN') return error('Acesso negado.', 403);
  try {
    const body = await parseBody<any>(request);
    if (body.confirmation !== 'APAGAR DADOS OPERACIONAIS') return error('Confirmação obrigatória.', 409);
    if (!['RESET_DATA', 'CLEANUP_PHANTOM_REQUESTS'].includes(body.action)) return error('Ação inválida.', 400);
    const db = getDb(env as any);
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
    if (settings?.riskAreaKey && settings.riskAreaKey !== body.securityKey) return error('Chave de segurança inválida.', 403);
    return json(await operationalCleanup(db, body.action));
  } catch {
    return error('Não foi possível concluir a limpeza.', 503);
  }
};
