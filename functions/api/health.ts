// functions/api/health.ts  →  GET /api/health
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
