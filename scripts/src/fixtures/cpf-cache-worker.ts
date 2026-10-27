// Local regression fixture, never deployed. The outbound service is mocked.
// @ts-ignore Shared backend implementation.
import { lookupCpf } from '../../../functions/_cpf-lookup.js';

export default {
  async fetch(request: Request) {
    let runtimeError: string | undefined;
    const result = await lookupCpf({
      body: { cpf: '12345678909', module: 'CNH_BRASIL' },
      user: { id: 'synthetic-user', role: 'ADMIN' },
      enabled: true,
      key: 'synthetic-key-not-a-credential',
      consumeQuota: async () => true,
      fetcher: async (url: Parameters<typeof fetch>[0], options?: RequestInit) => {
        const init = new URL(request.url).searchParams.has('legacyRedirect')
          ? { ...options, redirect: 'error' as const } : options;
        try { return await fetch(url, init); }
        catch (e) {
          runtimeError = e instanceof Error ? e.message : 'unknown';
          throw e;
        }
      },
    });
    return Response.json({ ...result.body, ...(runtimeError ? { runtimeError } : {}) }, { status: result.status });
  },
};
