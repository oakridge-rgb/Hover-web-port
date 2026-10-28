
/* ===== FATE PORTAL v8.2 JET LANE ENGINE (self-healing boot, reference recipe) ===== */
console.log('%c[FATE PORTAL v8.2] jet proxy engine loaded (self-healing boot)', 'color:#38bdf8;font-weight:bold;');

/* ---- jet asset edges (CDN fallback; local files win when hosted next to test.html) ---- */
const FATE_JET_EDGES = [
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://testingcf.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://quantil.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://cdn.statically.io/gh/TongSherbet/storage/main/',
  'https://raw.githack.com/TongSherbet/storage/main/'
];

/* movie-site shortcut set (FATE Movies page) */
const FATE_JET_APPS = [
  { label: 'Aether', url: 'https://aether.ist/', color: '#a78bfa',
    icon: '<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>' },
  { label: 'Tubi', url: 'https://tubitv.com/', color: '#ff7a59',
    icon: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4-6 4z"/>' },
  { label: 'Archive', url: 'https://archive.org/details/movies', color: '#fbbf24',
    icon: '<path d="M3 3h18v4H3V3zm1 6h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9zm5 2v2h6v-2H9z"/>' },
  { label: 'YouTube', url: 'https://www.youtube.com/feed/storefront', color: '#ff0000',
    icon: '<path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81zM10 15V9l5.2 3z"/>' }
];
let FATE_JET = null;
let FATE_FRAME = null; /* JetFrame wrapper around the browse iframe */
let FATE_JET_STATE = 'idle'; /* idle | booting | ready | sw-failed | transport-failed | controller-failed */
let FATE_JET_ERR = '';
let FATE_JET_PENDING = null;
let FATE_JET_BOOTING = null;
let FATE_HAS_UTILS = false;
let FATE_BROWSE_OPEN = false;
const FATE_ASSET_SRC = {}; /* file -> 'local' | 'local/sj' | 'mirror n' */
const fateSleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- boot stage pill (visible at top of page during boot — no more silent spinners) ---- */
let FATE_STAGE_AT = 0, FATE_STAGE_HINTED = false;
function fateJetStage(msg, kind){
  try {
    FATE_STAGE_AT = Date.now(); /* progress marker for the boot watchdog */
    let p = document.getElementById('fateJetStage');
    if (!p){
      p = document.createElement('div'); p.id = 'fateJetStage';
      p.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;background:rgba(12,10,9,.93);border:1px solid rgba(245,158,11,.45);color:#fcd34d;font:600 12px/1.35 system-ui,sans-serif;padding:.5rem .85rem;border-radius:999px;box-shadow:0 4px 18px rgba(0,0,0,.5);max-width:92vw;text-align:center;display:none;cursor:pointer;';
      document.body.appendChild(p);
    }
    if (!msg){ p.style.display = 'none'; p.onclick = null; return; }
    FATE_STAGE_AT = Date.now(); FATE_STAGE_HINTED = false;
    p.style.display = 'block';
    p.style.borderColor = kind === 'err' ? 'rgba(248,113,113,.65)' : kind === 'ok' ? 'rgba(74,222,128,.55)' : 'rgba(245,158,11,.45)';
    p.style.color = kind === 'err' ? '#f87171' : kind === 'ok' ? '#4ade80' : '#fcd34d';
    p.textContent = 'jet \u25b8 ' + msg;
    p.onclick = kind === 'err' ? () => { try { fateJetBoot(); } catch(e){} } : null;
    if (kind !== 'err'){
      setTimeout(() => {
        if (!FATE_STAGE_HINTED && Date.now() - FATE_STAGE_AT >= 7800 && p.style.display === 'block' && !FATE_STAGE_HINTED){
          FATE_STAGE_HINTED = true;
          p.textContent += ' \u2014 slow network/device, still working\u2026 (stuck over 30s? tap retry)';
        }
      }, 8000);
    }
  } catch(e){}
}

/* ---- device-fingerprint codec (verbatim port of the official portal's) ---- */
function fateJetFingerprint(){
  return [location.origin.replace(/^\w+:\/\/|:\d+$/g, ''), (new Date).getUTCMonth(),
    navigator.hardwareConcurrency, navigator.deviceMemory, navigator.platform,
    navigator.userAgent.replace(/[\d.]+/g, ''), (new Date).getTimezoneOffset()]
    .join().split('').reduce(((e, t) => Math.imul(e ^ t.charCodeAt(), 16777619)), 2166136261);
}
const FATE_JET_CODEC = {
  encode: e => {
    if (!e) return e;
    let t = globalThis.__jck ?? Object.defineProperty(globalThis, '__jck', { value: fateJetFingerprint() }).__jck;
    const r = e.startsWith('https://') && e.length > 8, o = (new TextEncoder).encode(r ? e.slice(8) : e);
    for (let e, r = 0; r < o.length; r++, e >>>= 8) 3 & r || (t ^= t << 13, t ^= t >>> 17, t ^= t << 5, e = t), o[r] ^= e;
    let n = '';
    for (let e = 0; e < o.length; e += 8192) n += String.fromCharCode.apply(null, o.subarray(e, e + 8192));
    return (r ? '' : 'Z0') + btoa(n).slice(0, (4 * o.length + 2) / 3 | 0).replace(/Z/g, 'Zz').replace(/\+/g, 'Zp').replace(/\//g, 'Zs');
  },
  decode: e => {
    if (!e) return e;
    let t = globalThis.__jck ?? Object.defineProperty(globalThis, '__jck', { value: fateJetFingerprint() }).__jck;
    const r = e.startsWith('Z0'), o = atob(e.slice(2 * r).replace(/Zp/g, '+').replace(/Zs/g, '/').replace(/Zz/g, 'Z')), n = new Uint8Array(o.length);
    for (let e, r = 0; r < n.length; r++, e >>>= 8) 3 & r || (t ^= t << 13, t ^= t >>> 17, t ^= t << 5, e = t), n[r] = o.charCodeAt(r) ^ e;
    return (r ? '' : 'https://') + new TextDecoder('utf-8', { ignoreBOM: true }).decode(n);
  }
};

/* ---- asset resolution: local flat -> local /sj/ -> CDN mirror ladder ---- */
function fateJetCandidates(file){
  const list = [new URL(file, location.href).href];
  try { list.push(new URL('sj/' + file, location.href).href); } catch(e){}
  for (const b of FATE_JET_EDGES) list.push(b + 'sj/' + file);
  return list;
}
function fateJetLabel(i){ return i === 0 ? 'local' : i === 1 ? 'local/sj' : 'mirror ' + (i - 1); }
async function fateJetProbe(url){
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { cache: 'no-store', signal: ac.signal });
    clearTimeout(t);
    if (!r.ok) return false;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return false; /* soft-404 guard */
    if (r.body && r.body.getReader){ try { const rd = r.body.getReader(); await rd.read(); await rd.cancel(); } catch(e){} }
    return true;
  } catch(e){ return false; }
}
async function fateJetLoadJs(file){
  const cands = fateJetCandidates(file);
  /* local-first fast path: when the file is hosted next to test.html, skip the
     7-mirror probe fan-out entirely (saves 5-20s per boot) */
  for (let i = 0; i < Math.min(2, cands.length); i++){
    if (await fateJetProbe(cands[i])){
      try { await fateLoadScript(cands[i]); FATE_ASSET_SRC[file] = fateJetLabel(i); return cands[i]; }
      catch(e){ /* local file broken — fall through to mirror ladder */ }
    }
  }
  const probes = await Promise.all(cands.map(u => fateJetProbe(u)));
  const order = cands.map((u, i) => [u, probes[i], i]).sort((a, b) => (b[1] - a[1]) || (a[2] - b[2])).map(x => x[0]);
  for (const u of order){
    try { await fateLoadScript(u); FATE_ASSET_SRC[file] = fateJetLabel(cands.indexOf(u)); return u; }
    catch(e){ /* next candidate */ }
  }
  throw new Error('could not load ' + file + ' from any source');
}
async function fateJetResolveUrl(file){
  const cands = fateJetCandidates(file);
  for (let i = 0; i < Math.min(2, cands.length); i++){
    if (await fateJetProbe(cands[i])){ FATE_ASSET_SRC[file] = fateJetLabel(i); return cands[i]; }
  }
  const probes = await Promise.all(cands.map(u => fateJetProbe(u)));
  for (let i = 0; i < cands.length; i++){
    if (probes[i]){ FATE_ASSET_SRC[file] = fateJetLabel(i); return cands[i]; }
  }
  FATE_ASSET_SRC[file] = 'unprobed';
  return cands[0]; /* last resort guess */
}

/* ---- boot helpers ---- */
function fateLoadScript(url){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    const to = setTimeout(() => rej(new Error('timeout loading ' + url)), 15000);
    s.src = url; s.async = false;
    s.onload = () => { clearTimeout(to); res(); };
    s.onerror = () => { clearTimeout(to); rej(new Error('failed to load ' + url)); };
    document.head.appendChild(s);
  });
}

/* ---- SW recovery toolkit (ported from the official portal's loader) ---- */
function fateSwSoftReload(){
  try { if (sessionStorage.fateJetSoft) return false; sessionStorage.fateJetSoft = '1'; } catch(e){ return false; }
  location.reload(); return true;
}
async function fateSwReset(){
  try { if (sessionStorage.fateJetReset) return false; sessionStorage.fateJetReset = '1'; } catch(e){ return false; }
  console.warn('[FATE v8.2] resetting service workers (unregister all + reload)');
  try { const regs = await Promise.race([
    navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))),
    fateSleep(2000)
  ]); } catch(e){}
  location.reload();
  return true;
}
async function fateSwAlive(reg, rounds){
  const n = rounds || 3;
  for (let i = 0; i < n; i++){
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 1500);
    try {
      const r = await fetch(new URL('__sw_alive', reg.scope), { cache: 'no-store', signal: ac.signal });
      if ((await r.text()) === 'true') return true;
    } catch(e){} finally { clearTimeout(t); }
    await fateSleep(150);
  }
  return false;
}

async function fateJetSwStart(){
  if (!('serviceWorker' in navigator)) throw new Error('service workers unsupported');
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('https required (service workers)');
  const swUrl = new URL('fate-sw.js', location.href).href;
  /* FAST PATH: page already controlled by our SW (SW was active at load time —
     100% reliable fetch interception). NO register()/update() churn — repeated
     re-registration is what destabilizes interception on claimed pages. */
  const ctl = navigator.serviceWorker.controller;
  if (ctl && /fate-sw\.js$/.test(ctl.scriptURL)){
    fateJetStage('checking service worker\u2026');
    const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
    if (reg){
      if (await fateSwAlive(reg)) { try { delete sessionStorage.fateJetSoft; } catch(e){} return ctl; }
      fateJetStage('sw slow to answer \u2014 continuing (routing self-heals)\u2026');
      console.warn('[FATE v8.2] sw_alive probe failed on fast path \u2014 continuing; frame loads retry via warming page');
      try { delete sessionStorage.fateJetSoft; } catch(e){}
      return ctl; /* NON-FATAL: handshake + warming retries cover the gap */
    }
  }
  fateJetStage('registering service worker\u2026');
  let reg;
  try {
    reg = await Promise.race([
      navigator.serviceWorker.register(swUrl, { scope: './', updateViaCache: 'none' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('registration timed out')), 20000))
    ]);
  } catch(e){ throw new Error('sw register failed: ' + (e.message || e)); }
  if (!reg.active){
    fateJetStage('activating service worker\u2026');
    await Promise.race([
      new Promise(res => {
        const w = reg.installing || reg.waiting;
        if (w) w.addEventListener('statechange', function(){ if (this.state === 'activated') res(); });
        reg.addEventListener('updatefound', () => { const nw = reg.installing; nw && nw.addEventListener('statechange', function(){ if (this.state === 'activated') res(); }); });
      }),
      new Promise((res, rej) => setTimeout(() => rej(new Error('activate timeout')), 15000))
    ]).catch(e => { throw new Error('sw not active: ' + (e.message || e)); });
  }
  if (!navigator.serviceWorker.controller){
    fateJetStage('claiming the page\u2026');
    try { (reg.active || reg.waiting || reg.installing).postMessage({ type: 'FATE:claim' }); } catch(e){}
    const changed = new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    /* redundant ONLY on a real redundant statechange of an existing worker (reference semantics) */
    const redundant = new Promise(r => {
      const w = reg.installing || reg.waiting;
      if (w) w.addEventListener('statechange', function(){ if (this.state === 'redundant') r(); });
    });
    await Promise.race([changed, redundant, fateSleep(8000)]);
  }
  if (!navigator.serviceWorker.controller){
    /* a claimed-mid-flight page has a fetch-race window; a RELOADED page with an
       active SW is controlled from birth (100% interception). Ladder, official style. */
    const stillInstalling = !!(reg.installing || reg.waiting);
    if (stillInstalling) throw new Error('service worker is still installing (slow network) \u2014 wait a moment, then tap retry');
    if (fateSwSoftReload()) return new Promise(() => {});
    if (await fateSwReset()) return new Promise(() => {});
    throw new Error('page never came under service worker control \u2014 reload the page once more');
  }
  fateJetStage('checking service worker\u2026');
  if (!await fateSwAlive(reg)){
    /* NON-FATAL on the fresh-install path too: the controller handshake is
       postMessage-based (always reliable); frame loads self-heal via the warming
       page's capped retries. Failing hard here is what caused endless boots. */
    console.warn('[FATE v8.2] sw_alive probe failed \u2014 continuing; routing self-heals');
    fateJetStage('sw warming \u2014 continuing\u2026');
  }
  try { delete sessionStorage.fateJetSoft; } catch(e){}
  return navigator.serviceWorker.controller;
}

function fateJetMakePlugins(){
  const plugs = [];
  if (!FATE_HAS_UTILS || !window.$jetUtils) return plugs;
  try {
    plugs.push(new $jetUtils.EventHandlerPlugin());
    plugs.push(new $jetUtils.LinkHandlerPlugin(href => { try { if (href) fateBrowseOpen(href); } catch(e){} }));
    plugs.push(new $jetUtils.UrlWatcherPlugin(href => {
      try {
        if (!FATE_BROWSE_OPEN || !href) return;
        const a = document.getElementById('fateBrowseAddr');
        if (a) a.value = href;
      } catch(e){}
    }));
    plugs.push(new $jetUtils.HttpCachePlugin());
  } catch(e){ console.warn('[FATE v8.2] utils plugins unavailable:', e); }
  return plugs;
}

/* memoized transport getter — avoids duplicate concurrent wisp sweeps */
async function fateGetTransport(){
  if (window.FATE_TRANSPORT) return window.FATE_TRANSPORT;
  if (fateGetTransport._p) return fateGetTransport._p;
  fateGetTransport._p = (async () => {
    try { return await fateLoadTransport(); }
    finally { delete fateGetTransport._p; }
  })();
  return fateGetTransport._p;
}

async function fateJetBoot(){
  if (FATE_JET_STATE === 'ready') return FATE_JET;
  if (FATE_JET_BOOTING) return FATE_JET_BOOTING;
  FATE_JET_STATE = 'booting'; FATE_JET_ERR = '';
  try { sessionStorage.fateBootResume = '1'; } catch(e){} /* auto-resume after recovery reloads */
  fateJetPaintStatus();
  fateJetStage('starting boot\u2026');
  FATE_JET_BOOTING = (async () => {
    try {
      await fateJetSwStart();
      if (!navigator.serviceWorker.controller) return null; /* page reloading */
    } catch(e){
      FATE_JET_STATE = 'sw-failed'; FATE_JET_ERR = String(e.message || e);
      FATE_JET_BOOTING = null; fateJetPaintStatus(); fateJetStage('service worker failed \u2014 tap to retry', 'err'); return null;
    }
    let coreUrl = null;
    try {
      fateJetStage('loading jet files\u2026');
      fateJetStage('loading jet.core.js\u2026');
      coreUrl = await fateJetLoadJs('jet.core.js');   /* defines $jet (must load first) */
      const apiP = fateJetLoadJs('jet.api.js');       /* defines $jetController (needs $jet) */
      fateJetStage('loading jet.api.js\u2026');
      /* utils MUST load after api: it destructures globalThis.$jetController at eval time */
      const utilsP = apiP.then(() => fateJetLoadJs('jet.utils.js')).catch(() => {}); /* optional */
      await apiP;
      if (typeof $jetController === 'undefined') throw new Error('jet.api.js did not define $jetController');
      const [injectUrl, wasmUrl] = await Promise.all([
        fateJetResolveUrl('jet.inject.js'),
        fateJetResolveUrl('jet.wasm')
      ]);
      try { await utilsP; } catch(e){}
      FATE_HAS_UTILS = typeof window.$jetUtils !== 'undefined';
      fateJetStage('connecting wisp tunnel\u2026');
      const transport = typeof fateLoadTransport === 'function' ? await fateGetTransport() : null;
      if (!transport){
        FATE_JET_STATE = 'transport-failed'; FATE_JET_ERR = 'wisp tunnel transport unavailable (no alive lane)';
        FATE_JET_BOOTING = null; fateJetPaintStatus(); fateJetStage('wisp tunnel down \u2014 tap to retry', 'err'); return null;
      }
      fateJetStage('starting jet controller\u2026');
      const prefix = new URL('./~/', location.href).pathname;
      FATE_JET = new $jetController.Controller({
        serviceworker: navigator.serviceWorker.controller,
        transport: transport,
        jetConfig: { maskedfiles: ['jet.inject.js', 'jet.wasm.js'], flags: { syncxhr: false, disableComputedWrap: false, rewriterLogs: false, captureErrors: false, cleanErrors: false, scramitize: false, sourcemaps: false, destructureRewrites: true, allowInvalidJs: true, debugTrampolines: false, debugSourceURL: false, allowFailedIntercepts: true, encapsulateWorkers: true } },
        config: { jetPath: coreUrl, wasmPath: wasmUrl, injectPath: injectUrl, virtualWasmPath: 'jet.wasm.js', codec: FATE_JET_CODEC, prefix: prefix }
      });
      /* ---- jet handshake: retry loop with FRESH MessageChannel port each round
              (verbatim port of the official portal's boot recipe — without this,
              a missed SW message = infinite "booting") ---- */
      let hsResolve;
      const hsPromise = new Promise(r => { hsResolve = r; });
      const __origResolve = FATE_JET.readyResolve;
      FATE_JET.readyResolve = function(){ try { hsResolve(true); } catch(e){} return __origResolve.apply(FATE_JET, arguments); };
      let handshook = await Promise.race([hsPromise, fateSleep(4000)]);
      for (let i = 0; !handshook; i++){
        if (i >= 5){
          if (await fateSwReset()) return null;   /* unregister all SWs + reload */
          throw new Error('the service worker never answered the jet handshake');
        }
        fateJetStage('retrying jet handshake (' + (i + 1) + '/5)\u2026');
        FATE_JET.serviceWorkerController = navigator.serviceWorker.controller || FATE_JET.serviceWorkerController;
        try { FATE_JET.setupMessagePort(); } catch(e){}
        handshook = await Promise.race([hsPromise, fateSleep(4000)]);
      }
      await FATE_JET.ready;
      FATE_JET.guardServiceWorkerRevive = false;
      FATE_JET_STATE = 'ready'; FATE_JET_ERR = '';
      fateJetEnsureUI();
      try { FATE_FRAME = FATE_JET.createFrame(document.getElementById('fateBrowseFrame'), { plugins: fateJetMakePlugins() }); }
      catch(e){ console.warn('[FATE v8.2] createFrame failed:', e); }
      try { sessionStorage.removeItem('fateWarmingN'); } catch(e){}
      try { sessionStorage.removeItem('fateBootResume'); sessionStorage.removeItem('fateJetPending'); } catch(e){}
      console.log('%c[FATE v8.2] jet proxy READY - prefix ' + FATE_JET.prefix + ' - assets: ' + JSON.stringify(FATE_ASSET_SRC), 'color:#38bdf8;font-weight:bold;');
      fateJetStage('ready', 'ok');
      setTimeout(() => { if (FATE_JET_STATE === 'ready') fateJetStage(null); }, 2500);
      fateJetPaintStatus();
      fateStartJetWatch();
      if (FATE_JET_PENDING){ const u = FATE_JET_PENDING; FATE_JET_PENDING = null; fateBrowseOpen(u); }
      return FATE_JET;
    } catch(e){
      if (String(e.message || e).includes('wisp tunnel')){
        FATE_JET_STATE = 'transport-failed';
      } else {
        FATE_JET_STATE = 'controller-failed'; FATE_JET_ERR = String(e.message || e);
      }
      FATE_JET_BOOTING = null; fateJetPaintStatus(); fateJetStage('boot failed \u2014 tap to retry', 'err'); return null;
    }
  })();
  /* boot watchdog: fires only when NO stage progress for 75s (mirror probes and
     handshake retries legitimately take a while — a stalled boot is silent) */
  const wd = setInterval(() => {
    if (FATE_JET_STATE === 'booting' && Date.now() - FATE_STAGE_AT > 75000){
      clearInterval(wd);
      FATE_JET_STATE = 'controller-failed'; FATE_JET_ERR = 'no boot progress for 75s \u2014 network or device too slow';
      FATE_JET_BOOTING = null; fateJetPaintStatus(); fateJetStage('stuck \u2014 tap to retry', 'err');
    }
    if (FATE_JET_STATE !== 'booting') clearInterval(wd);
  }, 5000);
  return FATE_JET_BOOTING;
}

/* ---- SW health watcher (official recipe): periodic sw_alive probe, fresh port on
        controllerchange, pending-RPC cleanup on pagehide. Survives iPad tab freezing. ---- */
let fateWatchBusy = null;
async function fateSwWatch(){
  if (fateWatchBusy) return fateWatchBusy;
  fateWatchBusy = (async () => {
    try {
      if (!FATE_JET || !navigator.serviceWorker) return;
      const c = navigator.serviceWorker;
      if (c.controller && FATE_JET.serviceWorkerController !== c.controller){
        FATE_JET.serviceWorkerController = c.controller;
        try { FATE_JET.setupMessagePort(); } catch(e){}
      }
      /* light health check: probe failure alone never resets (churn destabilizes);
         the frame-level warming page handles genuine dead-SW recovery */
      const reg = await c.getRegistration().catch(() => null);
      if (reg && !await fateSwAlive(reg, 1)){
        console.warn('[FATE v8.2] sw_alive light probe failed \u2014 will re-check next tick');
      }
    } catch(e){} finally { fateWatchBusy = null; }
  })();
  return fateWatchBusy;
}
function fateStartJetWatch(){
  try {
    const c = navigator.serviceWorker;
    setInterval(fateSwWatch, 20000);
    addEventListener('focus', fateSwWatch);
    document.addEventListener('visibilitychange', () => {
      try { if (!document.hidden) { try { sessionStorage.removeItem('fateWarmingN'); } catch(e){} fateSwWatch(); } } catch(e){}
    });
    c.addEventListener('controllerchange', () => {
      if (c.controller && FATE_JET){
        FATE_JET.serviceWorkerController = c.controller;
        try { FATE_JET.setupMessagePort(); } catch(e){}
      }
    });
    /* pending-RPC cleanup on pagehide (zombie-promise guard, official recipe) */
    if (FATE_JET.rpc){
      const inflight = new Set();
      const { recieve, sendRaw } = FATE_JET.rpc;
      FATE_JET.rpc.recieve = function(e){
        if (e && e[this.id] && e[this.id].$type === 'request') inflight.add(e[this.id].$token);
        return recieve.call(this, e);
      };
      FATE_JET.rpc.sendRaw = function(e, t){
        if (e && e[this.id] && e[this.id].$type === 'response') inflight.delete(e[this.id].$token);
        return sendRaw.call(this, e, t);
      };
      addEventListener('pagehide', () => {
        for (const tok of Array.from(inflight)){
          try { sendRaw.call(FATE_JET.rpc, { [FATE_JET.rpc.id]: { $type: 'response', $token: tok, $error: 'page closed' } }, []); } catch(e){}
        }
        inflight.clear();
      });
    }
  } catch(e){ console.warn('[FATE v8.2] watcher setup failed:', e); }
}

function fateSJEncode(url){
  if (!FATE_JET) return null;
  return location.origin + FATE_JET.prefix + FATE_JET.config.codec.encode(url);
}
function fateSJDecode(proxiedPath){
  try {
    if (!FATE_JET) return null;
    const p = new URL(proxiedPath, location.href).pathname;
    const prefixes = [];
    if (FATE_FRAME) prefixes.push(FATE_FRAME.prefix);
    prefixes.push(FATE_JET.prefix);
    for (const px of prefixes){
      if (p.startsWith(px)) return FATE_JET.config.codec.decode(p.slice(px.length));
    }
    return null;
  } catch(e){ return null; }
}

/* ---------- apps modal + browse view UI (built here, FATE style) ---------- */
function fateJetEnsureUI(){
  if (document.getElementById('fateAppsModal')) return;
  const style = document.createElement('style');
  style.textContent = `
  .fate-modal{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);}
  .fate-modal.open{display:flex;}
  .fate-box{width:min(460px,94vw);max-height:88vh;overflow-y:auto;background:#0c0a09;border:1px solid rgba(245,158,11,.35);border-radius:18px;padding:1.2rem;box-shadow:0 0 40px rgba(245,158,11,.12);}
  .fate-box h3{color:#fff;font-size:1.05rem;font-weight:800;display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;}
  .fate-box .sub{color:#94a3b8;font-size:.75rem;margin-bottom:1rem;}
  .fate-apps{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:.7rem;}
  .fate-app{display:flex;flex-direction:column;align-items:center;gap:.45rem;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:.85rem .3rem;cursor:pointer;transition:all .2s;}
  .fate-app:hover{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.08);transform:translateY(-2px);}
  .fate-app .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(0,0,0,.5);}
  .fate-app span{font-size:.66rem;font-weight:700;color:#e2e8f0;text-align:center;}
  .fate-status{margin-top:.9rem;font-size:.72rem;color:#94a3b8;line-height:1.5;background:rgba(0,0,0,.4);border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:.55rem .7rem;word-break:break-all;}
  .fate-close{position:absolute;top:.7rem;right:.9rem;background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;}
  #fateBrowseView{position:fixed;inset:0;z-index:60;display:none;flex-direction:column;background:#050505;}
  #fateBrowseView.open{display:flex;}
  .fate-chrome{display:flex;align-items:center;gap:.5rem;padding:.55rem .7rem;background:rgba(12,10,9,.95);border-bottom:1px solid rgba(245,158,11,.3);}
  .fate-chrome button{background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;font-size:.75rem;font-weight:700;padding:.4rem .65rem;border-radius:9px;cursor:pointer;white-space:nowrap;}
  .fate-chrome button:hover{background:rgba(245,158,11,.25);}
  .fate-addr{flex:1;background:rgba(0,0,0,.55);border:1px solid rgba(148,163,184,.3);border-radius:9px;padding:.42rem .7rem;color:#e2e8f0;font-size:.78rem;outline:none;min-width:60px;}
  #fateBrowseFrame{flex:1;width:100%;border:none;background:#fff;}
  .fate-hint{font-size:.68rem;color:#64748b;padding:.35rem .7rem;background:#0c0a09;border-top:1px solid rgba(148,163,184,.18);}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'fate-modal'; modal.id = 'fateAppsModal';
  modal.innerHTML = `<div class="fate-box" style="position:relative;">
    <button class="fate-close" onclick="fateToggleApps(false)">\u00d7</button>
    <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg> Movie Sites</h3>
    <div class="sub">Opens through the wisp tunnel \u2014 keep this tab foreground on iPad</div>
    <div class="fate-apps" id="fateAppsGrid"></div>
    <div class="fate-status" id="fateJetStatus">idle</div>
  </div>`;
  const grid = modal.querySelector('#fateAppsGrid');
  FATE_JET_APPS.forEach(a => {
    const d = document.createElement('div');
    d.className = 'fate-app';
    d.innerHTML = `<span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="${a.color}">${a.icon}</svg></span><span>${a.label}</span>`;
    d.onclick = () => { fateToggleApps(false); fateBrowseOpen(a.url); };
    grid.appendChild(d);
  });
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) fateToggleApps(false); });

  const view = document.createElement('div');
  view.id = 'fateBrowseView';
  view.innerHTML = `
    <div class="fate-chrome">
      <button onclick="fateBrowseBack()" title="Back">\u2190</button>
      <button onclick="fateBrowseReload()" title="Reload">\u21bb</button>
      <input class="fate-addr" id="fateBrowseAddr" placeholder="https://" spellcheck="false"
             onkeydown="if(event.key==='Enter')fateBrowseGo(this.value)"/>
      <button onclick="fateBrowsePopout()" title="Open direct (no proxy)">\u2197</button>
      <button onclick="fateBrowseClose()" title="Close">\u00d7</button>
    </div>
    <iframe id="fateBrowseFrame" referrerpolicy="no-referrer"></iframe>
    <div class="fate-hint">Back / reload ride the proxied frame. \u21b7 opens the site directly (no proxy). Keep this tab OPEN and in the foreground \u2014 it powers the tunnel (iPad freezes background tabs).</div>`;
  document.body.appendChild(view);
  const frame = view.querySelector('#fateBrowseFrame');
  frame.addEventListener('load', () => {
    try {
      const real = fateSJDecode(frame.contentWindow.location.href);
      if (real) document.getElementById('fateBrowseAddr').value = real;
    } catch(e){}
  });
}
function fateToggleApps(force){
  fateJetEnsureUI();
  const m = document.getElementById('fateAppsModal');
  const open = force !== undefined ? force : !m.classList.contains('open');
  m.classList.toggle('open', open);
  if (open){ fateJetPaintStatus(); if (FATE_JET_STATE !== 'ready') fateJetBoot(); }
}
function fateJetPaintStatus(){
  const el = document.getElementById('fateJetStatus');
  if (!el) return;
  const map = {
    idle: ['idle \u2014 open an app to boot the proxy', '#94a3b8'],
    booting: ['booting proxy (service worker \u2192 jet files \u2192 wisp tunnel \u2192 controller)\u2026 progress shown at the top of the page', '#fbbf24'],
    ready: ['proxy READY \u2014 apps open through your wisp tunnel lane', '#4ade80'],
    'sw-failed': ['service worker problem \u2014 the page auto-recovers (soft reload \u2192 SW reset). If this stays red: deploy fate-sw.js next to test.html (same folder, https) and reload. ' + FATE_JET_ERR, '#f87171'],
    'transport-failed': ['wisp tunnel down \u2014 no alive lane right now. Cloud view may recover it. ' + FATE_JET_ERR, '#f87171'],
    'controller-failed': ['jet controller failed \u2014 tap the red pill at the top to retry (auto-retried the handshake 5 times first). ' + FATE_JET_ERR, '#f87171']
  };
  const [txt, col] = map[FATE_JET_STATE] || [FATE_JET_STATE, '#94a3b8'];
  let assets = '';
  const keys = Object.keys(FATE_ASSET_SRC);
  if (keys.length) assets = '<br><span style="color:#64748b;">assets:</span> ' +
    keys.map(k => k + ': <b style="color:#67e8f9;">' + FATE_ASSET_SRC[k] + '</b>').join(' \u00b7 ') +
    ' \u00b7 utils: <b style="color:' + (FATE_HAS_UTILS ? '#4ade80' : '#94a3b8') + ';">' + (FATE_HAS_UTILS ? 'on' : 'off') + '</b>';
  el.innerHTML = '<b style="color:' + col + ';">jet: ' + txt + '</b>' + assets +
    (FATE_JET_STATE !== 'ready' ? ' \u00b7 <a href="#" onclick="fateJetBoot();return false;" style="color:#67e8f9;">retry</a>' : '');
}

/* ---------- browse view ---------- */
let fateBrowseStack = [], fateBrowseIdx = -1;
function fateBrowseOpen(url){
  fateJetEnsureUI();
  if (typeof stopTikTokPlayback === 'function') stopTikTokPlayback();
  if (!FATE_JET){
    FATE_JET_PENDING = url;
    try { sessionStorage.fateJetPending = url; } catch(e){} /* survives recovery reloads */
    fateToggleApps(true);
    return;
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  FATE_BROWSE_OPEN = true;
  const view = document.getElementById('fateBrowseView');
  const frame = document.getElementById('fateBrowseFrame');
  document.getElementById('fateBrowseAddr').value = url;
  view.classList.add('open');
  if (FATE_FRAME){ try { FATE_FRAME.go(url); } catch(e){ frame.src = fateSJEncode(url) || url; } }
  else frame.src = fateSJEncode(url) || url;
  fateBrowseStack = fateBrowseStack.slice(0, fateBrowseIdx + 1);
  fateBrowseStack.push(url); fateBrowseIdx = fateBrowseStack.length - 1;
}
function fateBrowseGo(input){
  let u = (input || '').trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = u.includes(' ') || !u.includes('.')
    ? 'https://www.google.com/search?q=' + encodeURIComponent(u) : 'https://' + u;
  fateBrowseOpen(u);
}
function fateBrowseBack(){
  if (FATE_FRAME){ try { FATE_FRAME.back(); return; } catch(e){} }
  const frame = document.getElementById('fateBrowseFrame');
  try { frame.contentWindow.history.back(); return; } catch(e){}
  if (fateBrowseIdx > 0){ fateBrowseIdx--; frame.src = fateSJEncode(fateBrowseStack[fateBrowseIdx]); }
}
function fateBrowseReload(){
  if (FATE_FRAME){ try { FATE_FRAME.reload(); return; } catch(e){} }
  const frame = document.getElementById('fateBrowseFrame');
  try { frame.contentWindow.location.reload(); } catch(e){ frame.src = frame.src; }
}
function fateBrowsePopout(){
  /* a popped-out proxied page has no live JetFrame; open the real URL instead */
  const cur = document.getElementById('fateBrowseAddr').value || fateBrowseStack[fateBrowseIdx];
  if (cur) window.open(cur, '_blank');
}
function fateBrowseClose(){
  FATE_BROWSE_OPEN = false;
  const view = document.getElementById('fateBrowseView');
  const frame = document.getElementById('fateBrowseFrame');
  view.classList.remove('open');
  try { frame.contentWindow.location.replace('about:blank'); } catch(e){ frame.src = 'about:blank'; }
}

/* ---- auto-resume after recovery reloads (soft reload / SW reset):
        the user taps an app once; the page reloads transparently and the boot
        continues by itself instead of dying on a dead spinner ---- */
(function fateJetAutoResume(){
  let resume = false, pending = null;
  try { resume = sessionStorage.fateBootResume === '1'; pending = sessionStorage.fateJetPending || null; } catch(e){}
  if (!resume) return;
  try { sessionStorage.removeItem('fateBootResume'); } catch(e){}
  console.log('[FATE v8.2] auto-resuming jet boot after recovery reload');
  const start = () => {
    if (pending){ FATE_JET_PENDING = pending; }
    fateJetBoot();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 600), { once: true });
  else setTimeout(start, 600);
})();
/* ===== END FATE PORTAL v8.2 JET LANE ENGINE ===== */

