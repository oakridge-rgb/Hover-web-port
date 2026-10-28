/* fate-sw.js v3 - FATE jet proxy service worker (SELF-CONTAINED)
 * Deploy NEXT TO test.html (same folder). jet.sw.js (MercuryWorkshop jet
 * 2.0.67-alpha.2) is INLINED below at build time - no CDN importScripts,
 * no mirror ladder, nothing external. Routing contract:
 *   shouldRoute(e) -> $jetController.route(e) for /~/<controller-id>/... paths
 *   no live controller -> ping clients ($controller$swrevive) + warming page
 * v3: warming auto-refresh is CAPPED (sessionStorage counter, 4 tries) -
 *     fixes the endless "proxy warming up" reload loop. After the cap the
 *     page shows a stuck-screen with a Retry button instead of looping.
 */
var $jetController;
/*__JET_SW_INLINE__*/

/* ---- FATE wiring ---- */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'FATE:claim') { self.clients.claim(); }
});

function fateWarming(){
  var tries = 0;
  try { tries = parseInt(sessionStorage.fateWarmingN || '0', 10) || 0; } catch (err) {}
  if (tries >= 4){
    /* cap reached - stop the reload loop, show a recoverable stuck screen */
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font:15px/1.6 system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0c0a09;color:#e2e8f0;text-align:center}' +
      '.c{max-width:340px;padding:1rem}button{margin-top:1rem;background:#f59e0b;border:none;color:#0c0a09;font-weight:800;' +
      'padding:.6rem 1.4rem;border-radius:10px;font-size:15px;cursor:pointer}li{text-align:left;color:#94a3b8}</style></head>' +
      '<body><div class="c"><b style="color:#fcd34d">proxy is stuck warming up</b>' +
      '<ul style="list-style:none;padding:0;font-size:13px;margin:.8rem 0 0">' +
      '<li>1. Go back to the portal tab and KEEP it open and in the foreground (iPads freeze background tabs).</li>' +
      '<li>2. Then come back here and tap Retry.</li></ul>' +
      '<button onclick="try{sessionStorage.fateWarmingN=\'0\'}catch(e){};location.reload()">Retry</button>' +
      '</div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }
  try { sessionStorage.fateWarmingN = String(tries + 1); } catch (err) {}
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"></head>' +
    '<body style="font:16px system-ui;display:grid;place-items:center;height:100vh;background:#0c0a09;color:#fcd34d">' +
    'proxy warming up, please wait... (auto-retry ' + (tries + 1) + '/4)</body></html>',
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

  /* /~/... with no live controller -> ping pages, bounded auto-retry (subfolder-safe) */
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
