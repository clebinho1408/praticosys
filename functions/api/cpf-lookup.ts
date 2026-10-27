import { eq } from 'drizzle-orm';
import { getDb, json, error, parseBody } from '../_db.js';
import { users, systemSettings } from '../../db/schema.js';
import { lookupCpf, consumeCpfQuota } from '../_cpf-lookup.js';

export const onRequest: PagesFunction<any> = async ({ request, env, data }) => {
  if (request.method !== 'POST') return error('Method Not Allowed', 405);
  try {
    const db = getDb(env);
    const [user] = await db.select({ id: users.id, role: users.role, allowedModules: users.allowedModules })
      .from(users).where(eq(users.id, String(data.sessionUserId)));
    const [settings] = await db.select({ enabled: systemSettings.cnhCpfAutofillEnabled })
      .from(systemSettings).where(eq(systemSettings.id, 1));
    const result = await lookupCpf({
      body: await parseBody(request), user, enabled: settings?.enabled === true,
      key: env.APICPF_API_KEY, consumeQuota: () => consumeCpfQuota(db, user.id),
    });
    const response = json(result.body, result.status);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch { return error('Não foi possível consultar o CPF. Preencha o nome manualmente.', 503); }
};
