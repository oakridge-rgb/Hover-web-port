/* fate-sw.js v2 - FATE jet proxy service worker (SELF-CONTAINED)
 * Deploy NEXT TO test.html (same folder). jet.sw.js (MercuryWorkshop jet
 * 2.0.67-alpha.2) is INLINED below at build time - no CDN importScripts,
 * no mirror ladder, nothing external. Routing contract:
 *   shouldRoute(e) -> $jetController.route(e) for /~/<controller-id>/... paths
 *   no live controller -> ping clients ($controller$swrevive) + 503 retry page
 */
var $jetController;
/*__JET_SW_INLINE__*/

/* ---- FATE wiring ---- */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'FATE:claim') { self.clients.claim(); }
});

function fateWarming(){
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"></head>' +
    '<body style="font:16px system-ui;display:grid;place-items:center;height:100vh;background:#0c0a09;color:#fcd34d">' +
    'proxy warming up, please wait...</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}

self.addEventListener('fetch', (event) => {
  let url;
  try { url = new URL(event.request.url); } catch (e) { return; }

  /* health probe used by the page */
  if (url.pathname.endsWith('/__/sw_alive')) {
    event.respondWith(new Response('true', { headers: { 'Content-Type': 'text/plain' } }));
    return;
  }

  /* jet-routed proxied requests */
  let routed = false;
  try {
    routed = !!(self.$jetController && $jetController.shouldRoute && $jetController.shouldRoute(event));
  } catch (e) { routed = false; }
  if (routed) {
    event.respondWith((async () => {
      try { return await $jetController.route(event); }
      catch (err) { console.error('[fate-sw] route error:', err); return fateWarming(); }
    })());
    return;
  }

  /* /~/... with no live controller -> ping pages, auto-retry (subfolder-safe) */
  if (url.pathname.includes('/~/')) {
    event.respondWith((async () => {
      try {
        const cs = await self.clients.matchAll({ includeUncontrolled: true });
        for (const c of cs) { try { c.postMessage({ $controller$swrevive: {} }); } catch (e) {} }
      } catch (e) {}
      return fateWarming();
    })());
  }
  /* everything else: untouched (no interception) */
});
