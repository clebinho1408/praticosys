// functions/api/events.ts  →  GET /api/events
// Cloudflare Pages Functions do not support long-lived SSE connections on the free plan.
// This endpoint returns a single SSE "ping" and closes immediately.
// The frontend already has setInterval polling (5s) as primary real-time mechanism.
// This prevents EventSource errors (net::ERR_INCOMPLETE_CHUNKED_ENCODING).
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
