/* fate-sw.js — FATE V8 jet proxy service worker (companion file)
 * Deploy NEXT TO test.html (same folder). Bootstraps the real jet.sw.js
 * (MercuryWorkshop jet 2.0.67-alpha.2) from jsDelivr mirrors, then routes
 * the /~/ prefix through the page's jet controller over the wisp tunnel.
 */
'use strict';

var FATE_JET_SW_SOURCES = [
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/sj/jet.sw.js',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/sj/jet.sw.js',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/sj/jet.sw.js',
  'https://testingcf.jsdelivr.net/gh/TongSherbet/storage@main/sj/jet.sw.js',
  'https://quantil.jsdelivr.net/gh/TongSherbet/storage@main/sj/jet.sw.js',
  'https://cdn.statically.io/gh/TongSherbet/storage/main/sj/jet.sw.js',
  'https://raw.githack.com/TongSherbet/storage/main/sj/jet.sw.js'
];

var fateJetLoaded = false;
for (var _i = 0; _i < FATE_JET_SW_SOURCES.length; _i++) {
  try { importScripts(FATE_JET_SW_SOURCES[_i]); fateJetLoaded = true; break; }
  catch (e) { /* try next mirror */ }
}
if (!fateJetLoaded) console.error('[fate-sw] could not importScripts jet.sw.js from any mirror');

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'FATE:claim') { self.clients.claim(); }
});

self.addEventListener('fetch', function (event) {
  event.respondWith((async function () {
    var url = new URL(event.request.url);
    /* health probe used by the page */
    if (url.pathname.endsWith('/__/sw_alive')) {
      return new Response('true', { headers: { 'Content-Type': 'text/plain' } });
    }
    if (fateJetLoaded && typeof $jetController !== 'undefined') {
      try {
        if ($jetController.shouldRoute(event)) {
          return await $jetController.route(event);
        }
      } catch (err) {
        console.error('[fate-sw] route error:', err);
      }
    }
    /* /~/<id>/... with no live controller -> ping pages, auto-retry */
    if (url.pathname.split('/')[1] === '~') {
      try {
        var cs = await self.clients.matchAll({ includeUncontrolled: true });
        for (var j = 0; j < cs.length; j++) cs[j].postMessage({ $controller$swrevive: {} });
      } catch (e) {}
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"></head>' +
        '<body style="font:16px system-ui;display:grid;place-items:center;height:100vh;background:#0c0a09;color:#fcd34d">' +
        'proxy warming up, please wait...</body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
      );
    }
    return fetch(event.request);
  })());
});
