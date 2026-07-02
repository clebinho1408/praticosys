// functions/api/health.ts  →  GET /api/health
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ status: 'ok', runtime: 'cloudflare-pages' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
