/* ==========================================================================
   FATE wisp service worker — epoxy-style browsing straight over the wisp lane
   --------------------------------------------------------------------------
   Serves proxied pages at:  <origin>/<dir>e/<encodeURIComponent(realUrl)>
   Traffic is carried by the libcurl (curl-transport) WASM client talking to
   the winning wisp relay passed in the query string (?wisp=wss://...).

   No jet / no scramjet: the HTML is served as-is with a <base> tag plus a
   small runtime that keeps absolute links inside the tunnel.
   ========================================================================== */
importScripts('./curl/index.plain.js');

const BASE = new URL('./', self.location.href).href;      /* dir this SW lives in */
const PREFIX = BASE + 'e/';                                /* absolute proxied prefix */
const WISP_URL = new URL(self.location.href).searchParams.get('wisp') || '';

/* ---------- libcurl client over the wisp lane ---------- */
let client = null, clientErr = null, waiters = [];
function ensureClient(){
  if (client) return Promise.resolve(client);
  if (clientErr) return Promise.reject(clientErr);
  if (!waiters.length){
    (async () => {
      try {
        if (!WISP_URL) throw new Error('no wisp lane passed to the service worker');
        if (!self.LibcurlClient) throw new Error('libcurl bundle failed to load');
        const c = new self.LibcurlClient({ wisp: WISP_URL });
        let lastErr = null;
        for (let i = 0; i < 40; i++){
          try { await c.init(); lastErr = null; break; }
          catch (e){
            lastErr = e;
            if (!/wasm/i.test(String(e))) break;
            await new Promise(r => setTimeout(r, 60));
          }
        }
        if (lastErr) throw lastErr;
        client = c;
        console.log('[FATE SW] wisp tunnel ready on', WISP_URL);
      } catch (e){
        clientErr = e;
        console.error('[FATE SW] wisp client init failed:', e);
      }
      const w = waiters; waiters = [];
      w.forEach(fn => fn());
    })();
  }
  return new Promise(res => waiters.push(res)).then(() => {
    if (client) return client;
    throw clientErr || new Error('tunnel client not ready');
  });
}
ensureClient();

/* ---------- tiny per-host cookie jar (helps redirects + consent walls) ---------- */
const jar = new Map();
function takeSetCookies(raw, u){
  const host = u.host;
  for (const pair of raw){
    if (String(pair[0] || '').toLowerCase() !== 'set-cookie') continue;
    const kv = String(pair[1]).split(';')[0];
    const name = kv.split('=')[0].trim();
    if (!name) continue;
    let arr = jar.get(host) || [];
    arr = arr.filter(c => c.split('=')[0].trim() !== name);
    arr.push(kv);
    jar.set(host, arr.slice(-25));
  }
}
function cookieFor(u){
  const a = jar.get(u.host);
  return a && a.length ? a.join('; ') : null;
}

/* ---------- URL codec ---------- */
function prox(real){ return PREFIX + encodeURIComponent(real); }
function decodeProxied(u){
  if (!u || !u.href || !u.href.startsWith(PREFIX)) return null;
  try { return new URL(decodeURIComponent(u.href.slice(PREFIX.length))); }
  catch (e){ return null; }
}

const STRIP_REQ = new Set([
  'host', 'connection', 'content-length', 'accept-encoding', 'cookie',
  'origin', 'referer', 'upgrade-insecure-requests', 'cache-control',
  'if-none-match', 'if-modified-since', 'if-match', 'if-unmodified-since',
  'if-range', 'range', 'pragma', 'dnt'
]);
const STRIP_RES = new Set([
  'content-encoding', 'content-length', 'transfer-encoding', 'accept-ranges',
  'content-security-policy', 'content-security-policy-report-only',
  'x-frame-options', 'strict-transport-security',
  'cross-origin-opener-policy', 'cross-origin-opener-policy-report-only',
  'cross-origin-embedder-policy', 'cross-origin-embedder-policy-report-only',
  'cross-origin-resource-policy', 'permissions-policy', 'report-to', 'nel',
  'set-cookie', 'clear-site-data', 'referrer-policy'
]);

/* ---------- runtime injected into proxied HTML ---------- */
const RUNTIME = '<script data-fate-wisp>(function(){' +
  'var REAL={{REAL}},PFX={{PFX}};' +
  'function px(u){try{u=new URL(u,REAL).href;return /^https?:/i.test(u)?(PFX+encodeURIComponent(u)):u}catch(e){return u}}' +
  'try{var _f=window.fetch?window.fetch.bind(window):null;' +
  'if(_f)window.fetch=function(input,init){' +
    'try{if(typeof input==="string"&&!/^(data:|blob:|about:)/i.test(input)){input=px(input)}}catch(e){}' +
    'return _f(input,init)' +
  '}}catch(e){}' +
  'try{var _xo=XMLHttpRequest.prototype.open;' +
  'XMLHttpRequest.prototype.open=function(m,u){' +
    'try{if(typeof u==="string")u=px(u)}catch(e){}' +
    'return _xo.apply(this,[m,u].concat([].slice.call(arguments,2)))' +
  '}}catch(e){}' +
  'document.addEventListener("click",function(e){' +
    'if(e.defaultPrevented)return;' +
    'var el=e.target;while(el&&el.nodeType===1&&el.tagName!=="A")el=el.parentNode;' +
    'if(!el||el.nodeType!==1)return;' +
    'var h=el.getAttribute("href")||"";' +
    'if(!h||/^(javascript:|mailto:|tel:|data:|blob:|about:|#)/i.test(h))return;' +
    'if(el.hasAttribute("download"))return;' +
    'var abs;try{abs=new URL(h,REAL).href}catch(x){return}' +
    'if(!/^https?:/i.test(abs))return;' +
    'e.preventDefault();e.stopPropagation();' +
    'var dest=PFX+encodeURIComponent(abs);' +
    'if(el.target==="_blank"){try{window.open(dest,"_blank")}catch(x){}}' +
    'else{window.location.href=dest}' +
  '},false);' +
  'try{var _o=window.open?window.open.bind(window):null;' +
  'if(_o)window.open=function(u,t,f){try{return _o(px(u),t,f)}catch(e){return _o(u,t,f)}}}catch(e){}' +
  'try{var _p=history.pushState.bind(history),_r=history.replaceState.bind(history);' +
  'function fx(u){try{return (typeof u==="string"&&/^https?:\\/\\//i.test(u))?(PFX+encodeURIComponent(u)):u}catch(e){return u}}' +
  'history.pushState=function(s,t,u){return _p(s,t,fx(u))};' +
  'history.replaceState=function(s,t,u){return _r(s,t,fx(u))}}catch(e){}' +
  '})();<\/script>';

function injectHtml(html, tUrl){
  const head = '<meta name="referrer" content="unsafe-url"><base href="' + prox(tUrl.href) + '">' +
               RUNTIME.replace('{{REAL}}', JSON.stringify(tUrl.href)).replace('{{PFX}}', JSON.stringify(PREFIX));
  html = html.replace(/<base\b[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '');
  html = html.replace(/<meta[^>]+name=["']?referrer["']?[^>]*>/gi, '');
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.slice(0, m.index + m[0].length) + head + html.slice(m.index + m[0].length);
  const m2 = html.match(/<html[^>]*>/i);
  if (m2) return html.slice(0, m2.index + m2[0].length) + '<head>' + head + '</head>' + html.slice(m2.index + m2[0].length);
  return head + html;
}

/* ---------- friendly error page (shown inside the pane) ---------- */
function errorResponse(status, title, msg){
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{background:#0a0908;color:#e2e8f0;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}' +
    '.c{max-width:540px;text-align:center;padding:2rem;border:1px solid rgba(245,158,11,.35);border-radius:18px;background:rgba(0,0,0,.4)}' +
    'h2{color:#fcd34d;margin:0 0 .5rem;font-size:1.05rem}p{color:#94a3b8;line-height:1.6;font-size:.86rem;margin:.3rem 0}' +
    'button{margin-top:1rem;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.45);color:#fcd34d;font-weight:700;' +
    'padding:.5rem 1.1rem;border-radius:10px;cursor:pointer}</style></head><body><div class="c">' +
    '<h2>' + title + '</h2><p>' + msg + '</p><button onclick="location.reload()">Retry</button></div></body></html>';
  return new Response(html, { status: status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/* ---------- the proxy pipeline ---------- */
function reqReferer(req){
  /* Chromium does not expose the Referer header to service workers,
     but req.referrer always carries it. */
  try {
    const r = req.referrer;
    if (r && r !== 'about:client' && r !== 'no-referrer') return r;
  } catch (e){}
  return req.headers.get('referer');
}

async function handle(req, target){
  let c;
  try { c = await ensureClient(); }
  catch (err){ return errorResponse(502, 'wisp tunnel down', 'The lane could not start: ' + (err && err.message || err)); }

  const tUrl = new URL(target.href);
  const headers = new Headers();
  req.headers.forEach((v, k) => {
    const kl = k.toLowerCase();
    if (STRIP_REQ.has(kl) || kl.startsWith('sec-fetch-') || kl.startsWith('proxy-')) return;
    headers.set(k, v);
  });
  const ref = reqReferer(req);
  if (ref){
    try { const rt = decodeProxied(new URL(ref)); if (rt) headers.set('referer', rt.href); } catch (e){}
  }
  const ck = cookieFor(tUrl);
  if (ck) headers.set('cookie', ck);

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD'){
    try { const ab = await req.arrayBuffer(); if (ab.byteLength) body = ab; } catch (e){}
  }

  let r;
  try { r = await c.request(tUrl, req.method, body, headers, req.signal); }
  catch (err){
    return errorResponse(502, 'request failed', 'The tunnel could not fetch ' + tUrl.host + ' — ' + (err && err.message || err));
  }

  const raw = r.headers || [];
  takeSetCookies(raw, tUrl);

  const outHeaders = new Headers();
  let location = null;
  for (const pair of raw){
    const n = String(pair[0] || ''), nl = n.toLowerCase();
    if (!n) continue;
    if (nl === 'location'){ location = String(pair[1]); continue; }
    if (STRIP_RES.has(nl)) continue;
    try { outHeaders.append(n, String(pair[1])); } catch (e){}
  }
  /* full proxied referer on subresources is what lets the SW route
     root-relative assets (/w/load.php, /api/...) to the right target */
  try { outHeaders.set('referrer-policy', 'unsafe-url'); } catch (e){}

  if ([301, 302, 303, 307, 308].indexOf(r.status) > -1 && location){
    try {
      const next = new URL(location, tUrl).href;
      return Response.redirect(prox(next), r.status);
    } catch (e){ /* fall through as normal response */ }
  }

  let data = r.body;
  if (data && data.getReader){ try { data = await new Response(data).arrayBuffer(); } catch (e){ data = null; } }

  const ctRaw = (outHeaders.get('content-type') || '').toLowerCase();
  if (ctRaw.includes('text/html') && data != null && r.status < 400){
    let text = null;
    const mCS = /charset=([\w-]+)/i.exec(ctRaw);
    try {
      const td = new TextDecoder(mCS ? mCS[1] : 'utf-8');
      text = td.decode(typeof data === 'string' ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    } catch (e){ try { text = new TextDecoder('utf-8').decode(data); } catch (e2){ text = null; } }
    if (text != null){
      data = injectHtml(text, tUrl);
      outHeaders.set('content-type', 'text/html; charset=utf-8');
    }
  }

  try { return new Response(data, { status: r.status || 200, statusText: r.statusText || '', headers: outHeaders }); }
  catch (e){ return errorResponse(502, 'bad response', 'The tunnel returned an unusable response.'); }
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST' &&
      req.method !== 'PUT' && req.method !== 'DELETE' && req.method !== 'PATCH') return;
  let u;
  try { u = new URL(req.url); } catch (err){ return; }
  if (u.origin !== self.location.origin) return;

  let target = decodeProxied(u);
  if (!target && req.method === 'GET'){
    /* root-relative subresources of a proxied page (/js/app.js, /api/...) —
       resolve them against the target of the proxied referer */
    const ref = reqReferer(req);
    if (ref && ref.startsWith(PREFIX)){
      const rt = decodeProxied(new URL(ref));
      if (rt && /^https?:$/.test(rt.protocol)){
        try { target = new URL(u.pathname + u.search, rt); } catch (err){}
      }
    }
  }
  if (!target) return; /* site's own files load normally */
  e.respondWith(handle(req, target));
});

/* ---------- install / activate / ping ---------- */
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'fate-ping') return;
  const reply = ok => {
    try {
      e.source.postMessage({
        type: 'fate-wisp-sw', ok: ok,
        wisp: WISP_URL, prefix: PREFIX,
        err: clientErr ? String(clientErr.message || clientErr) : null
      });
    } catch (x){}
  };
  ensureClient().then(() => reply(true)).catch(() => reply(false));
});
