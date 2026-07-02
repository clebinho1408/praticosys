// functions/api/events.ts  →  GET /api/events
// Cloudflare Pages Functions do not support long-lived SSE connections.
// Returns a single ping and closes — frontend falls back to polling.
export const onRequestGet: PagesFunction = async () => {
  const body = 'event: ping\ndata: {}\n\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
