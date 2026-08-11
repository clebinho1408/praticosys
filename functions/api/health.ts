// functions/api/health.ts  →  GET /api/health
export const onRequestGet: PagesFunction<{ RESEND_API_KEY?: string; DATABASE_URL?: string }> = async ({ env }) => {
  return new Response(JSON.stringify({
    status: 'ok',
    runtime: 'cloudflare-pages',
    emailConfigured: Boolean(env.RESEND_API_KEY),
    databaseConfigured: Boolean(env.DATABASE_URL),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
