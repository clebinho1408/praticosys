// functions/api/events.ts
// Cloudflare Pages Functions don't support long-lived SSE connections on the free plan.
// This endpoint acts as a polling heartbeat — clients can GET it and compare timestamps
// to know when to refresh. The real refresh is driven by setInterval polling in each component.
export const onRequestGet: PagesFunction = async () => {
  return new Response(
    `data: {"type":"heartbeat","ts":${Date.now()}}\n\n`,
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};
