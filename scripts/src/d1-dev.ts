import http from 'node:http';
import { localD1, seedD1, pagesHarness } from './d1-runtime.js';

// Only the explicitly configured CPF integration receives its own credential.
// Resend/vehicle credentials remain excluded; synthetic seeds keep CPF lookup off.
const runtime = await localD1(true);
await seedD1(runtime.db);
const harness = await pagesHarness({
  ...runtime.env,
  ...(process.env.APICPF_API_KEY ? { APICPF_API_KEY: process.env.APICPF_API_KEY } : {}),
});
const port = Number(process.env.PORT || 8080);
const server = http.createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 9_000_000) { res.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const request = new Request(`http://d1-local${req.url}`, {
      method: req.method, headers: req.headers as any,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const response = await harness.dispatch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Erro no ambiente D1 local. Consulte os testes e as migrações.' }));
  }
});
server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`[d1-local] API on PORT=${port}; isolated synthetic data; Neon is not connected.\n`);
});
const stop = async () => { server.close(); await harness.drain(); await runtime.mf.dispose(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
