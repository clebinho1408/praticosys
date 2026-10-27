import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = await readFile(path.join(root, 'wrangler.toml'), 'utf8');
const compatibilityDate = /compatibility_date\s*=\s*"([^"]+)"/.exec(config)![1];
const compatibilityFlags = JSON.parse(/compatibility_flags\s*=\s*(\[[^\]]+\])/.exec(config)![1]) as string[];
const outdir = path.join(root, 'generated-artifacts/cpf-cloudflare-test');
await mkdir(outdir, { recursive: true });
const scriptPath = path.join(outdir, 'worker.js');
execFileSync('pnpm', ['exec', 'esbuild', 'scripts/src/fixtures/cpf-cache-worker.ts',
  '--bundle', '--format=esm', '--platform=browser', `--outfile=${scriptPath}`], { cwd: root, stdio: 'pipe' });

let outboundCalls = 0;
async function run(flags: string[], legacyRedirect = false, redirectResponse = false) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, modulesRoot: root, scriptPath,
    compatibilityDate, compatibilityFlags: flags,
    // All outbound traffic is intercepted, including the synthetic CPF/key.
    outboundService: async (request: Request) => {
      outboundCalls++;
      const url = new URL(request.url);
      assert.equal(url.origin, 'https://apicpf.com');
      assert.equal(request.headers.get('X-API-KEY'), 'synthetic-key-not-a-credential');
      if (redirectResponse) return new Response(null, { status: 302, headers: { Location: 'https://unexpected.invalid/' } });
      return Response.json({ code: 200, data: { nome: 'Pessoa Fictícia' } });
    },
  }));
  try {
    const response = await mf.dispatchFetch(`http://test/cpf${legacyRedirect ? '?legacyRedirect' : ''}`);
    return { status: response.status, body: await response.json() };
  } finally { await mf.dispose(); }
}

// Reproduce exactly the production failure without the opt-in compatibility flag.
const legacy = await run(compatibilityFlags.filter(f => f !== 'cache_option_enabled'));
assert.equal(legacy.status, 503);
assert.equal((legacy.body as any).error, 'Não foi possível conectar ao serviço de CPF. Preencha o nome manualmente.');
assert.match((legacy.body as any).runtimeError, /cache.*not implemented/i);
assert.equal(outboundCalls, 0, 'Legacy runtime must fail before contacting the provider');

assert.ok(compatibilityFlags.includes('cache_option_enabled'), 'Wrangler must enable the no-store API');
const oldRedirect = await run(compatibilityFlags, true);
assert.equal(oldRedirect.status, 503);
assert.match((oldRedirect.body as any).runtimeError, /Invalid redirect value/);
assert.equal(outboundCalls, 0, 'Unsupported redirect mode also fails before contacting APICPF');
const fixed = await run(compatibilityFlags);
assert.equal(fixed.status, 200, JSON.stringify({ fixed, outboundCalls }));
assert.deepEqual(fixed.body, { name: 'Pessoa Fictícia' });
assert.equal(outboundCalls, 1);
const redirect = await run(compatibilityFlags, false, true);
assert.equal(redirect.status, 503);
assert.match((redirect.body as any).error, /redirecionamento inesperado/);
assert.equal(outboundCalls, 2, 'Redirect must never be followed or leak the key');
process.stdout.write(`CPF Cloudflare: reproduced both pre-request failures, verified success and blocked redirects with production compatibility date ${compatibilityDate}; outbound mocked, no credits or real CPF used.\n`);
