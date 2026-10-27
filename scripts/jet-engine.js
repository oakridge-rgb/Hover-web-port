/* ===== FATE PORTAL v8 JET LANE ENGINE ===== */
console.log('%c[FATE PORTAL v8] jet proxy engine loaded', 'color:#38bdf8;font-weight:bold;');

/* ---- jet asset edges (core/api/utils/wasm all served from one base) ---- */
const FATE_JET_EDGES = [
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://testingcf.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://quantil.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://cdn.statically.io/gh/TongSherbet/storage/main/',
  'https://raw.githack.com/TongSherbet/storage/main/'
];

const FATE_JET_APPS = [
  { label: 'TikTok', url: 'https://www.tiktok.com/foryou', color: '#25f4ee',
    icon: '<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>' },
  { label: 'YouTube', url: 'https://www.youtube.com/', color: '#ff0000',
    icon: '<path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81zM10 15V9l5.2 3z"/>' },
  { label: 'Snapchat', url: 'https://web.snapchat.com/', color: '#fffc00',
    icon: '<path d="M12 2c3 0 5 2.2 5 5.2 0 1.1-.1 2.1-.2 3 .5.2 1.1 0 1.6-.2.6-.2 1.2-.1 1.4.4.2.6-.3 1-1 1.4-.6.3-1.5.7-1.6 1.3-.1.5.3 1.2 1 2 .8 1 2 2.1 3.5 2.5.4.1.6.5.4.9-.1.3-.5.6-1.2.8-.5.1-1 .2-1.2.5-.1.2-.1.5-.2.8-.1.3-.3.5-.7.4-.5-.1-1.1-.2-1.8-.1-.7.1-1.3.4-2 .8-.9.6-1.9 1.3-3.2 1.3s-2.3-.7-3.2-1.3c-.7-.4-1.3-.7-2-.8-.7-.1-1.3 0-1.8.1-.4.1-.6-.1-.7-.4-.1-.3-.1-.6-.2-.8-.2-.3-.7-.4-1.2-.5-.7-.2-1.1-.5-1.2-.8-.2-.4 0-.8.4-.9C4.5 18 5.7 16.9 6.5 15.9c.7-.8 1.1-1.5 1-2-.1-.6-1-1-1.6-1.3-.7-.4-1.2-.8-1-1.4.2-.5.8-.6 1.4-.4.5.2 1.1.4 1.6.2-.1-.9-.2-1.9-.2-3C7 4.2 9 2 12 2z"/>' },
  { label: 'Movies', url: 'https://aether.ist/', color: '#a78bfa',
    icon: '<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>' }
];

let FATE_JET = null;
let FATE_FRAME = null; /* JetFrame wrapper around the browse iframe */
let FATE_JET_STATE = 'idle'; /* idle | booting | ready | sw-failed | assets-failed | transport-failed | controller-failed */
let FATE_JET_ERR = '';
let FATE_JET_PENDING = null;
let FATE_JET_BOOTING = null;

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

/* ---- boot helpers ---- */
function fateLoadScript(url){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.async = false;
    s.onload = res; s.onerror = () => rej(new Error('failed to load ' + url));
    document.head.appendChild(s);
  });
}

async function fateJetSwStart(){
  if (!('serviceWorker' in navigator)) throw new Error('service workers unsupported');
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('https required');
  const swUrl = new URL('fate-sw.js', location.href).href;
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register(swUrl, { scope: './' });
  const swRef = reg.active || reg.waiting || reg.installing;
  if (!swRef) throw new Error('sw registration empty');
  if (!navigator.serviceWorker.controller){
    try { swRef.postMessage({ type: 'FATE:claim' }); } catch(e){}
    await Promise.race([
      new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })),
      new Promise(r => setTimeout(r, 6000))
    ]);
  }
  if (!navigator.serviceWorker.controller){
    try {
      if (!sessionStorage.fateJetSoft){ sessionStorage.fateJetSoft = '1'; location.reload(); return new Promise(() => {}); }
    } catch(e){}
    throw new Error('page is not under sw control (reload once)');
  }
  return navigator.serviceWorker.controller;
}

async function fateJetBoot(){
  if (FATE_JET_STATE === 'ready') return FATE_JET;
  if (FATE_JET_BOOTING) return FATE_JET_BOOTING;
  FATE_JET_STATE = 'booting'; FATE_JET_ERR = '';
  fateJetPaintStatus();
  FATE_JET_BOOTING = (async () => {
    try {
      await fateJetSwStart();
    } catch(e){
      FATE_JET_STATE = 'sw-failed'; FATE_JET_ERR = String(e.message || e);
      FATE_JET_BOOTING = null; fateJetPaintStatus(); return null;
    }
    let base = null;
    try {
      for (const b of FATE_JET_EDGES){
        try {
          if (typeof window.$jet === 'undefined') await fateLoadScript(b + 'sj/jet.core.js');
          await fateLoadScript(b + 'sj/jet.api.js');
          await fateLoadScript(b + 'sj/jet.utils.js');
          base = b; break;
        } catch(e){ /* next edge (core may already be loaded from this one) */ }
      }
    } catch(e){}
    if (!base || typeof $jetController === 'undefined'){
      FATE_JET_STATE = 'assets-failed'; FATE_JET_ERR = 'could not load jet core/api/utils from any mirror';
      FATE_JET_BOOTING = null; fateJetPaintStatus(); return null;
    }
    const transport = typeof fateLoadTransport === 'function' ? await fateLoadTransport() : null;
    if (!transport){
      FATE_JET_STATE = 'transport-failed'; FATE_JET_ERR = 'wisp tunnel transport unavailable (no alive lane)';
      FATE_JET_BOOTING = null; fateJetPaintStatus(); return null;
    }
    try {
      const prefix = new URL('./~/', location.href).pathname;
      FATE_JET = new $jetController.Controller({
        serviceworker: navigator.serviceWorker.controller,
        transport: transport,
        jetConfig: { maskedfiles: ['jet.inject.js', 'jet.wasm.js'], flags: { syncxhr: false, disableComputedWrap: false, rewriterLogs: false, captureErrors: false, cleanErrors: false, scramitize: false, sourcemaps: false, destructureRewrites: true, allowInvalidJs: true, debugTrampolines: false, debugSourceURL: false, allowFailedIntercepts: true, encapsulateWorkers: true } },
        config: { jetPath: base + 'sj/jet.core.js', wasmPath: base + 'sj/jet.wasm', injectPath: base + 'sj/jet.inject.js', virtualWasmPath: 'jet.wasm.js', codec: FATE_JET_CODEC, prefix: prefix }
      });
      await FATE_JET.ready;
      FATE_JET_STATE = 'ready';
      fateJetEnsureUI();
      try { FATE_FRAME = FATE_JET.createFrame(document.getElementById('fateBrowseFrame'), {}); }
      catch(e){ console.warn('[FATE v8] createFrame failed:', e); }
      console.log('%c[FATE v8] jet proxy READY - prefix ' + FATE_JET.prefix, 'color:#38bdf8;font-weight:bold;');
      fateJetPaintStatus();
      if (FATE_JET_PENDING){ const u = FATE_JET_PENDING; FATE_JET_PENDING = null; fateBrowseOpen(u); }
      return FATE_JET;
    } catch(e){
      FATE_JET_STATE = 'controller-failed'; FATE_JET_ERR = String(e.message || e);
      FATE_JET_BOOTING = null; fateJetPaintStatus(); return null;
    }
  })();
  return FATE_JET_BOOTING;
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
  .fate-box{width:min(430px,92vw);background:#0c0a09;border:1px solid rgba(245,158,11,.35);border-radius:18px;padding:1.2rem;box-shadow:0 0 40px rgba(245,158,11,.12);}
  .fate-box h3{color:#fff;font-size:1.05rem;font-weight:800;display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;}
  .fate-box .sub{color:#94a3b8;font-size:.75rem;margin-bottom:1rem;}
  .fate-apps{display:grid;grid-template-columns:repeat(4,1fr);gap:.7rem;}
  .fate-app{display:flex;flex-direction:column;align-items:center;gap:.45rem;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:.85rem .3rem;cursor:pointer;transition:all .2s;}
  .fate-app:hover{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.08);transform:translateY(-2px);}
  .fate-app .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(0,0,0,.5);}
  .fate-app span{font-size:.68rem;font-weight:700;color:#e2e8f0;}
  .fate-status{margin-top:.9rem;font-size:.72rem;color:#94a3b8;line-height:1.5;background:rgba(0,0,0,.4);border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:.55rem .7rem;}
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
    <h3><svg width="18" height="18" viewBox="0 0 24 24" fill="#38bdf8"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg> FATE Apps</h3>
    <div class="sub">Real sites through the wisp tunnel \u2014 same lane as cloud games</div>
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
    <div class="fate-hint">Back / reload ride the proxied frame. ↗ opens the site directly (no proxy). Keep this tab open — it powers the tunnel.</div>`;
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
    booting: ['booting proxy (service worker + jet + wisp tunnel)\u2026', '#fbbf24'],
    ready: ['proxy READY \u2014 apps open through your wisp tunnel lane', '#4ade80'],
    'sw-failed': ['service worker unavailable \u2014 deploy fate-sw.js next to test.html (same folder, https) and reload. ' + FATE_JET_ERR, '#f87171'],
    'assets-failed': ['jet assets unreachable from every mirror \u2014 try again later. ' + FATE_JET_ERR, '#f87171'],
    'transport-failed': ['wisp tunnel down \u2014 no alive lane right now. Cloud view may recover it. ' + FATE_JET_ERR, '#f87171'],
    'controller-failed': ['jet controller failed \u2014 reload the page once. ' + FATE_JET_ERR, '#f87171']
  };
  const [txt, col] = map[FATE_JET_STATE] || [FATE_JET_STATE, '#94a3b8'];
  el.innerHTML = '<b style="color:' + col + ';">jet: ' + txt + '</b>' +
    (FATE_JET_STATE !== 'ready' ? ' \u00b7 <a href="#" onclick="fateJetBoot();return false;" style="color:#67e8f9;">retry</a>' : '');
}

/* ---------- browse view ---------- */
let fateBrowseStack = [], fateBrowseIdx = -1;
function fateBrowseOpen(url){
  fateJetEnsureUI();
  if (typeof stopTikTokPlayback === 'function') stopTikTokPlayback();
  if (!FATE_JET){
    FATE_JET_PENDING = url;
    fateToggleApps(true);
    return;
  }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const view = document.getElementById('fateBrowseView');
  const frame = document.getElementById('fateBrowseFrame');
  document.getElementById('fateBrowseAddr').value = url;
  view.classList.add('open');
  if (FATE_FRAME) FATE_FRAME.go(url);
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
  const view = document.getElementById('fateBrowseView');
  const frame = document.getElementById('fateBrowseFrame');
  view.classList.remove('open');
  try { frame.contentWindow.location.replace('about:blank'); } catch(e){ frame.src = 'about:blank'; }
}
/* ===== END FATE PORTAL v8 JET LANE ENGINE ===== */
