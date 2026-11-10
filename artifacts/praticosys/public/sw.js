/* PráticoSys — service worker mínimo para instalação como app (PWA).
 * Estratégia: NÃO cacheia /api nem o index.html (sempre rede, para nunca servir
 * uma versão antiga do sistema após um deploy). Apenas os assets com hash do
 * Vite (/assets/*) e os ícones são cacheados, pois são imutáveis por nome. */
const CACHE = 'praticosys-static-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;              // API: sempre rede
  const cacheable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/');
  if (!cacheable) return;                                    // HTML e demais: sempre rede
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
