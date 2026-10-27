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
var $jetController;(()=>{var e={805(e,t,r){r.d(t,{C:()=>o});class o{methods;id;sendRaw;counter=0;promiseCallbacks=new Map;constructor(e,t,r){this.methods=e,this.id=t,this.sendRaw=r}recieve(e){if(null==e||"object"!=typeof e)return;let t=e[this.id];if(null==t||"object"!=typeof t)return;let r=t.$type;if("response"===r){let e=t.$token,r=t.$data,o=t.$error,s=this.promiseCallbacks.get(e);if(!s)return;this.promiseCallbacks.delete(e),void 0!==o?s.reject(Error(o)):s.resolve(r)}else if("request"===r){let e=t.$method,r=t.$args;this.methods[e](r).then(e=>{this.sendRaw({[this.id]:{$type:"response",$token:t.$token,$data:e?.[0]}},e?.[1])}).catch(e=>{console.error(e),this.sendRaw({[this.id]:{$type:"response",$token:t.$token,$error:e?.toString()||"Unknown error"}},[])})}}call(e,t,r=[]){let o=this.counter++;return new Promise((s,i)=>{this.promiseCallbacks.set(o,{resolve:s,reject:i}),this.sendRaw({[this.id]:{$type:"request",$method:e,$args:t,$token:o}},r)})}}}},t={};function r(o){var s=t[o];if(void 0!==s)return s.exports;var i=t[o]={exports:{}};return e[o](i,i.exports,r),i.exports}r.d=(e,t)=>{for(var o in t)r.o(t,o)&&!r.o(e,o)&&Object.defineProperty(e,o,{enumerable:!0,get:t[o]})},r.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})};var o={};(()=>{r.r(o),r.d(o,{route:()=>a,shouldRoute:()=>n});var e=r(805);let t={};addEventListener("message",e=>{if(e.data&&"object"==typeof e.data){if(e.data.$sw$setCookieDone&&"object"==typeof e.data.$sw$setCookieDone){let r=e.data.$sw$setCookieDone,o=t[r.id];o&&(o(),delete t[r.id])}if(e.data.$sw$initRemoteTransport&&"object"==typeof e.data.$sw$initRemoteTransport){let{port:t,prefix:r}=e.data.$sw$initRemoteTransport,o=i.find(e=>new URL(r).pathname.startsWith(e.prefix));if(!o)return void console.error("No relevant controller found for transport init");o.rpc.call("initRemoteTransport",t,[t])}}});class s{prefix;id;rpc;constructor(r,o,s){this.prefix=r,this.id=o,this.rpc=new e.C({sendSetCookie:async({cookies:e,options:r})=>{let o=await self.clients.matchAll(),s=[],i=[],n=r?.destination==="document"||r?.destination==="iframe";for(let a of o){let o=Math.random().toString(36).substring(2,10);s.push(o),a.postMessage({$controller$setCookie:{cookies:e,options:r,id:o}}),n||i.push(new Promise(e=>{t[o]=()=>e(o)}))}if(i.length>0){let r,n=!1,a=new Promise(i=>{r=setTimeout(()=>{if(!n){let r=s.filter(e=>void 0!==t[e]);console.error(`timed out waiting for set cookie response (deadlock?): cookies=${e.length} clients=${o.length} pending=${r.length}/${s.length} clientUrls=${o.map(e=>e.url).join(",")}`)}i()},1e3)});try{await Promise.race([a,Promise.any(i).then(()=>{n=!0}).catch(()=>{})])}finally{for(let e of(void 0!==r&&clearTimeout(r),s))delete t[e]}}}},"tabchannel-"+o,(e,t)=>{s.postMessage(e,t)}),s.onmessage=e=>{this.rpc.recieve(e.data)},s.onmessageerror=console.error,this.rpc.call("ready",void 0)}}let i=[];function n(e){let t=new URL(e.request.url);return void 0!==i.find(e=>t.pathname.startsWith(e.prefix))}async function a(e){try{let t=new URL(e.request.url),r=i.find(e=>t.pathname.startsWith(e.prefix)),o=await clients.get(e.clientId),s=[...e.request.headers],n=await r.rpc.call("request",{rawUrl:e.request.url,rawReferrer:e.request.referrer,destination:e.request.destination,mode:e.request.mode,referrer:e.request.referrer,method:e.request.method,body:e.request.body,cache:e.request.cache,forceCrossOriginIsolated:!1,initialHeaders:s,rawClientUrl:o?o.url:void 0,clientId:e.clientId||e.resultingClientId},e.request.body instanceof ReadableStream||e.request.body instanceof ArrayBuffer?[e.request.body]:void 0);return new Response(n.body,{status:n.status,statusText:n.statusText,headers:n.headers})}catch(e){return console.error("Service Worker error:",e),new Response("Internal Service Worker Error: "+e.message,{status:500})}}addEventListener("message",e=>{if(!e.data||"object"!=typeof e.data||!e.data.$controller$init||"object"!=typeof e.data.$controller$init)return;let t=e.data.$controller$init,r=i.findIndex(e=>e.id===t.id);-1!==r&&i.splice(r,1),i.push(new s(t.prefix,t.id,e.ports[0]))}),addEventListener("install",()=>{self.skipWaiting()}),addEventListener("activate",e=>{e.waitUntil(clients.claim())}),setTimeout(async()=>{for(let e of await clients.matchAll())e.postMessage({$controller$swrevive:{}})},100)})(),$jetController=o})();

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
