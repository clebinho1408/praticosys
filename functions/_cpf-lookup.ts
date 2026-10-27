import { sql } from 'drizzle-orm';

export const normalizeCpf = (value: string) => value.replace(/\D/g, '');
export function validCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const digit = (sum * 10) % 11 % 10;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}

type Identity = { id: string; role: string; allowedModules?: unknown };
export function canLookupCpf(user: Identity | undefined): boolean {
  if (!user || !['ADMIN', 'SUPERVISOR', 'OPERATOR', 'INSTRUCTOR'].includes(user.role)) return false;
  if (['OPERATOR', 'SUPERVISOR'].includes(user.role) && Array.isArray(user.allowedModules)
    && user.allowedModules.length && !user.allowedModules.includes('cnh')) return false;
  return true;
}
export function cpfSettingError(body: any, role?: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, 'cnhCpfAutofillEnabled')) return;
  if (role !== 'ADMIN') return 'Somente administradores podem configurar o autopreenchimento.';
  if (typeof body.cnhCpfAutofillEnabled !== 'boolean') return 'A ativação deve ser verdadeira ou falsa.';
  return undefined;
}

const messages: Record<number, string> = {
  400: 'CPF inválido para consulta.',
  404: 'CPF não encontrado.',
  402: 'Serviço de consulta sem créditos.',
  401: 'Chave do serviço de CPF inválida ou ausente.',
  403: 'Chave do serviço de CPF expirada ou sem autorização.',
  429: 'Limite de consultas atingido. Aguarde antes de tentar novamente.',
};
const fail = (status: number, message: string) => ({
  status, body: { error: `${message} Preencha o nome manualmente.` },
});

// Shared by Pages and Express. Never log the CPF, upstream URL, key or payload.
export async function lookupCpf(options: {
  body: any; user?: Identity; enabled: boolean; key?: string;
  consumeQuota: () => Promise<boolean>; fetcher?: typeof fetch; timeoutMs?: number;
}): Promise<{ status: number; body: { name: string } | { error: string } }> {
  if (!options.user) return fail(401, 'Faça login novamente.');
  if (!canLookupCpf(options.user) || options.body?.module !== 'CNH_BRASIL') return fail(403, 'Consulta não autorizada neste módulo.');
  if (!options.enabled) return fail(409, 'Autopreenchimento desativado.');
  if (typeof options.body?.cpf !== 'string' || !validCpf(options.body.cpf)) return fail(400, messages[400]);
  if (!options.key) return fail(503, 'Serviço de CPF não configurado no servidor.');
  if (!await options.consumeQuota()) return fail(429, messages[429]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const url = new URL('https://apicpf.com/api/consulta');
    url.searchParams.set('cpf', normalizeCpf(options.body.cpf));
    const response = await (options.fetcher ?? fetch)(url, {
      headers: { 'X-API-KEY': options.key, Accept: 'application/json' },
      // Workers only implement follow/manual, not redirect:"error".
      // Never follow redirects carrying the API key or CPF to another origin.
      signal: controller.signal, redirect: 'manual', cache: 'no-store',
    });
    if (response.status >= 300 && response.status < 400) {
      return fail(503, 'O serviço de CPF retornou um redirecionamento inesperado.');
    }
    const payload = await response.json().catch(() => null) as any;
    const code = response.ok ? Number(payload?.code ?? response.status) : response.status;
    if (code !== 200) return fail([400, 404, 429].includes(code) ? code : 503,
      messages[code] ?? 'Serviço de CPF indisponível.');
    const name = payload?.data?.nome;
    if (typeof name !== 'string' || !name.trim() || name.length > 300) return fail(503, 'Resposta inválida do serviço de CPF.');
    return { status: 200, body: { name: name.trim() } };
  } catch {
    return fail(503, controller.signal.aborted ? 'Consulta de CPF demorou demais.' : 'Não foi possível conectar ao serviço de CPF.');
  } finally { clearTimeout(timer); }
}

// Atomic and shared across instances; no CPF/name is stored in the quota table.
export async function consumeCpfQuota(db: any, userId: string): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const result = await db.execute(sql`
    INSERT INTO cotas_consulta_cpf (id, janela_minuto, consultas) VALUES (${userId}, ${minute}, 1)
    ON CONFLICT (id) DO UPDATE SET janela_minuto = excluded.janela_minuto,
      consultas = CASE WHEN cotas_consulta_cpf.janela_minuto = excluded.janela_minuto
        THEN cotas_consulta_cpf.consultas + 1 ELSE 1 END
    WHERE cotas_consulta_cpf.janela_minuto != excluded.janela_minuto OR cotas_consulta_cpf.consultas < 10
    RETURNING id
  `);
  return ((result as any).rows ?? result).length > 0;
}
