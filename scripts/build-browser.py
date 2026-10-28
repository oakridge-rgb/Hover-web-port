#!/usr/bin/env python3
# build-browser.py — FATE Browser: a multi-tab web browser page next to the v8.2 portal.
# Reuses the SAME folder: fate-sw.js + jet.* (already hosted for test.html) — zero new deps.
# One JetFrame per tab (createFrame is multi-frame by design: prefix + frameId per frame).
import os, shutil

BASE = "/home/z/my-project"
ENGINE = open(f"{BASE}/scripts/jet-engine.js", encoding="utf-8").read()      # verbatim v8.2 boot
BROWSER = open(f"{BASE}/scripts/browser-engine.js", encoding="utf-8").read()

# ---- V6 access gate (same auth as the portal / movies) ----
GATE = r"""
/* ===== V6 ACCESS GATE (same auth as the portal — opens straight through if you're logged in) ===== */
(function(){
  var AUTH_KEY='fate_v6_auth';
  function passes(){
    if(typeof FATE_PASS==='undefined')return['fate2026'];
    return Array.isArray(FATE_PASS)?FATE_PASS.map(String):[String(FATE_PASS)];
  }
  function hash(s){
    var h=5381;
    for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;
    return h.toString(36);
  }
  function isAuthed(){
    try{
      var v=localStorage.getItem(AUTH_KEY);
      return !!v&&passes().map(hash).indexOf(v)>-1;
    }catch(e){return false}
  }
  if(!isAuthed()){
    location.replace('index.html');
  }
})();
"""

# ---- host-side wisp lane engine (same lane cache key as the portal) ----
WISP = r"""
/* ===== FATE BROWSER WISP LANE HOST (shared fate_wisp_lane_v6 cache with the portal) ===== */
function _lsGet(k){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ return null; } }
function _lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

const FATE_WISP_SERVERS = [
  'cdn.northstreetumc.org','cdn.vipersfutbol.com','cdn.pcesc.org','cdn.kcchallengevbc.com',
  'cdn.slcbmooc.org','cdn.topstargym.net','cdn.goaplytexas.org','cdn.clearfieldswimming.com',
  'cdn.richardacademy.cfd','wss://athollcottage.com/connection/','wss://api.personalloanonline.net/ws/'
];
const FATE_ASSET_BASES = [
  'https://cdn.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://quantil.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://fastly.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://testingcf.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://gcore.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://originfastly.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://cdn.statically.io/gh/TongSherbet/storage/main/',
  'https://rawcdn.githack.com/TongSherbet/storage/main/',
  'https://raw.githack.com/TongSherbet/storage/main/',
  'https://raw.githubusercontent.com/TongSherbet/storage/main/',
  'https://cdn.staticdeliver.com/gh/TongSherbet/storage@main/'
];
const FATE_WISP_LANE_KEY = 'fate_wisp_lane_v6';
window.FATE_WISP_RESULTS = [];

function fateWispUrl(s){ return s.includes('://') ? s : ('wss://' + s + '/'); }

/* exact port of the working portal's testWlspDomain() — binary wisp handshake */
function fateTestWlsp(server, timeoutMs){
  return new Promise(resolve => {
    let ws;
    try{ ws = new WebSocket(fateWispUrl(server)); }catch(e){ return resolve(null); }
    ws.binaryType = 'arraybuffer';
    const id = (Math.floor(4294967294 * Math.random()) + 1) >>> 0;
    let gotEcho = false, t0 = 0;
    const finish = v => {
      clearTimeout(timer);
      try{ ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); }catch(e){}
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs || 4500);
    ws.onerror = () => finish(null);
    ws.onclose = () => { if(!gotEcho) finish(null); };
    ws.onmessage = evt => {
      const d = evt.data;
      if(!(d instanceof ArrayBuffer) || d.byteLength < 5) return finish(null);
      const dv = new DataView(d);
      const type = dv.getUint8(0), sid = dv.getUint32(1, true);
      if(gotEcho){ if(sid === id) finish(Math.round(performance.now() - t0)); return; }
      if(sid === 0){
        if(type === 5) ws.send(new Uint8Array([5,0,0,0,0,2,1]));
        else if(type === 3){
          const host = '127.0.0.1';
          const hb = new TextEncoder().encode(host);
          const frame = new Uint8Array([1,0,0,0,0,1,69,0,...hb]);
          new DataView(frame.buffer).setUint32(1, id, true);
          gotEcho = true; t0 = performance.now();
          try{ ws.send(frame); }catch(e){ return finish(null); }
        }
      }
    };
  });
}

async function fateWispSweep(){
  const cached = _lsGet(FATE_WISP_LANE_KEY);
  if(cached && cached.url && Date.now() - cached.t < 10 * 60 * 1000){
    window.wlspServer = cached.url; /* trust briefly; still re-verify below */
  }
  const probes = FATE_WISP_SERVERS.map(async s => ({ server: s, rtt: await fateTestWlsp(s, 4500) }));
  window.FATE_WISP_RESULTS = await Promise.all(probes);
  const alive = window.FATE_WISP_RESULTS.filter(r => r.rtt !== null).sort((a, b) => a.rtt - b.rtt);
  if(alive.length){
    window.wlspServer = fateWispUrl(alive[0].server);
    window.WlspPing = alive[0].rtt;
    window.WlspIsBackup = alive[0].server.includes('://');
    _lsSet(FATE_WISP_LANE_KEY, { url: window.wlspServer, t: Date.now() });
  }
  return window.FATE_WISP_RESULTS;
}

/* curl-transport (libcurl-wasm) over the winning wisp lane */
async function fateLoadTransport(){
  if(window.FATE_TRANSPORT) return window.FATE_TRANSPORT;
  if(!window.wlspServer || !window.FATE_WISP_RESULTS.some(r => r.rtt !== null)) await fateWispSweep();
  if(!window.wlspServer) return null;
  for(const base of FATE_ASSET_BASES){
    try{
      const mod = await import(base + 'curl/index.mjs');
      const C = mod.default || mod.LibcurlClient;
      if(!C) continue;
      const t = new C({ wisp: window.wlspServer });
      for (let _ti = 0; _ti < 150; _ti++){
        try { await t.init(); break; }
        catch (_e){
          if (!String(_e).includes('wasm not loaded') || _ti === 149) throw _e;
          await new Promise(_r => setTimeout(_r, 20));
        }
      }
      window.FATE_TRANSPORT = t;
      window.FATE_ASSETS_BASE_USED = base;
      console.log('[FATE BROWSER] wisp transport READY - lane', window.wlspServer, '- assets', base);
      return t;
    }catch(e){ console.warn('[FATE BROWSER] transport base failed:', base, (e && e.message) || e); }
  }
  console.warn('[FATE BROWSER] no asset base could serve curl/index.mjs');
  return null;
}
/* ===== END WISP LANE HOST ===== */
"""

CSS = """
:root{--primary:#f59e0b;--secondary:#ef4444;--accent:#10b981;--bg-deep:#050505;--glass:rgba(0,0,0,0.55);--glass-border:rgba(255,255,255,0.1);--text:#f8fafc;--text-muted:#cbd5e1}
*{box-sizing:border-box;margin:0;padding:0}
html{height:100%}
body{height:100%;position:fixed;inset:0;overflow:hidden;background:var(--bg-deep);color:var(--text);font-family:"Inter",sans-serif;padding-top:calc(60px + env(safe-area-inset-top,0px));-webkit-tap-highlight-color:transparent}
.bg-image{position:fixed;inset:0;z-index:0;background:url("/img/background.png") center center/cover no-repeat}
.bg-overlay{position:fixed;inset:0;z-index:1;background:rgba(5,5,5,0.55);backdrop-filter:blur(4px)}
/* ---- top nav ---- */
.nav-glass{position:fixed;top:0;left:0;right:0;z-index:50;height:calc(60px + env(safe-area-inset-top,0px));padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px;background:rgba(5,5,5,0.6);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--glass-border)}
.nav-inner{height:100%;display:flex;justify-content:space-between;align-items:center;gap:10px}
.nav-brand{display:flex;align-items:center;gap:11px;min-width:0}
.nav-logo{width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(245,158,11,0.4);flex-shrink:0}
.nav-logo span{font-weight:800;font-size:16px;color:white;font-family:"Space Grotesk",sans-serif}
.nav-title{font-family:"Space Grotesk",sans-serif;font-size:1.05rem;font-weight:700;background:linear-gradient(135deg,#fff,#fcd34d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap}
.nav-links{display:flex;gap:8px;align-items:center;flex-wrap:nowrap}
.nav-link{padding:8px 14px;border-radius:11px;font-weight:500;color:var(--text-muted);text-decoration:none;display:flex;align-items:center;gap:7px;transition:all .3s cubic-bezier(.4,0,.2,1);background:none;border:none;cursor:pointer;font-family:inherit;font-size:.82rem;white-space:nowrap}
.nav-link:hover{background:rgba(56,189,248,0.1);color:#fff}
.fm-chip{padding:7px 12px;border-radius:11px;font-size:.68rem;font-weight:700;border:1px solid rgba(148,163,184,.25);white-space:nowrap;background:rgba(0,0,0,0.4)}
.panic-btn{padding:8px 14px;border-radius:11px;background:linear-gradient(135deg,#dc2626,#991b1b);color:white;font-weight:700;font-size:.78rem;border:none;cursor:pointer;display:flex;align-items:center;gap:7px;box-shadow:0 4px 18px rgba(220,38,38,0.4);transition:all .3s ease;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
.panic-btn:hover{transform:scale(1.05);box-shadow:0 8px 28px rgba(220,38,38,0.6)}
/* ---- app frame ---- */
#fbApp{position:relative;z-index:4;display:flex;flex-direction:column;height:calc(100% - 60px - env(safe-area-inset-top,0px))}
#fbTabstrip{display:flex;align-items:flex-end;gap:7px;padding:8px 10px 0;flex-shrink:0}
#fbTabs{display:flex;gap:6px;overflow-x:auto;flex:1;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:0}
#fbTabs::-webkit-scrollbar{display:none}
.fb-tab{display:flex;align-items:center;gap:7px;flex:0 0 auto;min-width:104px;max-width:180px;height:38px;padding:0 8px 0 9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-bottom:none;border-radius:12px 12px 0 0;cursor:pointer;transition:background .2s,border-color .2s}
.fb-tab:hover{background:rgba(255,255,255,.09)}
.fb-tab.active{background:rgba(245,158,11,.13);border-color:rgba(245,158,11,.55)}
.fb-tab-ic{width:20px;height:20px;border-radius:6px;background:rgba(0,0,0,.5);display:grid;place-items:center;font-size:.6rem;font-weight:800;color:#fcd34d;flex-shrink:0}
.fb-tab-ic.loading{background:transparent}
.fb-tab-ic.loading::after{content:"";width:13px;height:13px;border:2px solid rgba(245,158,11,.25);border-top-color:#f59e0b;border-radius:50%;animation:spin 1s linear infinite}
.fb-tab-title{flex:1;font-size:.72rem;font-weight:600;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-tab.active .fb-tab-title{color:#fff}
.fb-tab-x{width:18px;height:18px;border-radius:5px;display:grid;place-items:center;color:#64748b;font-size:.9rem;flex-shrink:0;line-height:1}
.fb-tab-x:hover{background:rgba(239,68,68,.3);color:#f87171}
#fbNewTabBtn{width:34px;height:34px;flex:0 0 auto;margin-bottom:2px;border-radius:10px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;font-size:1.15rem;cursor:pointer;line-height:1}
#fbNewTabBtn:hover{background:rgba(245,158,11,.25)}
/* ---- toolbar ---- */
#fbToolbar{display:flex;gap:7px;align-items:center;padding:8px 10px;background:rgba(8,7,6,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(245,158,11,.28);flex-shrink:0}
.fb-tb{width:38px;height:38px;flex:0 0 auto;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e2e8f0;font-size:1.02rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.fb-tb:hover{background:rgba(245,158,11,.15);border-color:rgba(245,158,11,.45);color:#fcd34d}
#fbGoBtn{width:auto;padding:0 15px;font-weight:800;font-size:.8rem;color:#fcd34d;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.4)}
.fb-addr{flex:1;height:38px;background:rgba(0,0,0,.55);border:1px solid rgba(148,163,184,.3);border-radius:11px;padding:0 14px;color:#e2e8f0;font-size:.88rem;outline:none;min-width:50px;font-family:inherit}
.fb-addr:focus{border-color:rgba(245,158,11,.5);box-shadow:0 0 0 3px rgba(245,158,11,.12)}
.fb-addr::placeholder{color:#64748b}
/* ---- panes ---- */
#fbPanes{flex:1;position:relative;background:#fff;min-height:0}
.fb-pane{position:absolute;inset:0;display:none;background:#fff}
.fb-pane.active{display:block}
.fb-frame{position:absolute;inset:0;width:100%;height:100%;border:none;background:#fff}
.fb-progress{position:absolute;top:0;left:0;right:0;height:3px;z-index:7;display:none;background:linear-gradient(90deg,transparent 0%,rgba(245,158,11,.95) 50%,transparent 100%);background-size:50% 100%;background-repeat:no-repeat;animation:fbSlide 1.1s linear infinite}
.fb-pane.loading .fb-progress{display:block}
@keyframes fbSlide{0%{background-position:-60% 0}100%{background-position:160% 0}}
.fb-connect{position:absolute;inset:0;z-index:8;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(8,7,6,.96);text-align:center;padding:2rem}
.fb-pane.connecting .fb-connect{display:flex}
.fb-spin{width:40px;height:40px;border:3px solid rgba(245,158,11,.2);border-top-color:#f59e0b;border-radius:50%;animation:spin 1s linear infinite}
.fb-connect b{color:#fcd34d;font-size:.95rem;font-family:"Space Grotesk",sans-serif}
.fb-connect span{color:#94a3b8;font-size:.78rem;max-width:430px;line-height:1.55}
/* ---- start page (new tab) ---- */
.fb-start{position:absolute;inset:0;z-index:5;display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#0a0908}
.fb-pane.at-home .fb-start{display:block}
.fb-start-scroll{max-width:720px;margin:0 auto;padding:42px 22px 64px}
.fb-brandrow{display:flex;align-items:center;gap:15px;margin-bottom:1.5rem}
.fb-logo{width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:grid;place-items:center;font:800 25px "Space Grotesk",sans-serif;color:#fff;box-shadow:0 0 26px rgba(245,158,11,.4);flex-shrink:0}
.fb-brandrow h1{font-family:"Space Grotesk",sans-serif;font-size:1.65rem;font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#fff 0%,#fcd34d 55%,#38bdf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.15}
.fb-brandrow p{color:#94a3b8;font-size:.84rem;margin-top:2px}
.fb-srow{display:flex;gap:.6rem;margin-bottom:1.5rem}
.fb-search{flex:1;height:52px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.09);border-radius:16px;color:var(--text);font-size:.98rem;outline:none;transition:all .3s ease;font-family:inherit;padding:0 20px}
.fb-search:focus{border-color:rgba(56,189,248,0.45);box-shadow:0 0 0 3px rgba(56,189,248,0.1)}
.fb-search::placeholder{color:#64748b}
.fb-go{padding:0 24px;height:52px;border-radius:16px;border:none;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;font-weight:800;font-size:.92rem;cursor:pointer;white-space:nowrap;box-shadow:0 8px 25px rgba(245,158,11,0.35);transition:all .3s ease;font-family:inherit}
.fb-go:hover{transform:translateY(-2px);box-shadow:0 12px 35px rgba(245,158,11,0.5)}
.fb-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(94px,1fr));gap:.7rem;margin-bottom:1.5rem}
.fb-tile{display:flex;flex-direction:column;align-items:center;gap:.5rem;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:.9rem .3rem;cursor:pointer;transition:all .2s}
.fb-tile:hover{border-color:rgba(56,189,248,.55);background:rgba(56,189,248,.08);transform:translateY(-2px)}
.fb-tile .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(0,0,0,.5)}
.fb-tile .lbl{font-size:.66rem;font-weight:700;color:#e2e8f0;text-align:center}
.fb-movies{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(167,139,250,.16),rgba(245,158,11,.1));border:1px solid rgba(167,139,250,.4);border-radius:16px;padding:14px 18px;margin-bottom:1.5rem;text-decoration:none;color:#e2e8f0;transition:all .25s}
.fb-movies:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(167,139,250,.18);border-color:rgba(167,139,250,.65)}
.fb-movies svg{width:30px;height:30px;fill:#a78bfa;flex:0 0 auto}
.fb-movies b{font-family:"Space Grotesk",sans-serif;display:block;color:#fff;font-size:.98rem}
.fb-movies i{font-style:normal;font-size:.74rem;color:#94a3b8}
.fb-recent{margin-bottom:1.5rem}
.fb-recent h3{font-family:"Space Grotesk",sans-serif;font-size:.74rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:.65rem}
.fb-recent-row{display:flex;flex-wrap:wrap;gap:.5rem}
.fb-recent-chip{display:flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.25);color:#cbd5e1;font-size:.73rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}
.fb-recent-chip:hover{border-color:rgba(245,158,11,.5);color:#fff;background:rgba(245,158,11,.08)}
.fb-recent-chip .dot{width:8px;height:8px;border-radius:50%;background:#38bdf8;flex-shrink:0}
.fb-note{font-size:.7rem;color:#64748b;line-height:1.55;background:rgba(0,0,0,.35);border:1px solid rgba(148,163,184,.18);border-radius:12px;padding:.7rem .95rem}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
/* ---- responsive ---- */
@media(max-width:760px){
  .nav-glass{padding:calc(8px + env(safe-area-inset-top,0px)) 10px 8px}
  .nav-title{display:none}
  .nav-link{padding:7px 10px;font-size:.74rem}
  .panic-btn{padding:7px 10px}
  .fm-chip{display:none}
  .fb-tab{min-width:88px;max-width:150px}
  .fb-tb{width:34px;height:34px}
  #fbGoBtn{padding:0 11px;font-size:.72rem}
  .fb-addr{font-size:.8rem;padding:0 10px}
  #fbNewTabBtn{width:30px;height:30px}
  .fb-start-scroll{padding:30px 16px 54px}
  .fb-brandrow h1{font-size:1.35rem}
  .fb-tiles{grid-template-columns:repeat(auto-fill,minmax(80px,1fr))}
}
"""

BODY = """
<div class="bg-image"></div><div class="bg-overlay"></div>
<nav class="nav-glass"><div class="nav-inner">
  <div class="nav-brand">
    <div class="nav-logo"><span>F</span></div>
    <div class="nav-title">FATE Browser</div>
  </div>
  <div class="nav-links">
    <span class="fm-chip" id="fbJetChip">tunnel: idle</span>
    <a class="nav-link" href="movies.html" title="Dedicated FATE movies page">Movies</a>
    <a class="nav-link" href="test.html" title="Back to the FATE portal">Portal</a>
    <button class="panic-btn" onclick="location.replace('index.html')" title="Emergency exit"><span>Panic</span></button>
  </div>
</div></nav>
<div id="fbApp">
  <div id="fbTabstrip">
    <div id="fbTabs"></div>
    <button id="fbNewTabBtn" title="New tab">+</button>
  </div>
  <div id="fbToolbar">
    <button class="fb-tb" id="fbBackBtn" title="Back">&#8592;</button>
    <button class="fb-tb" id="fbFwdBtn" title="Forward">&#8594;</button>
    <button class="fb-tb" id="fbRelBtn" title="Reload">&#8635;</button>
    <button class="fb-tb" id="fbHomeBtn" title="Home (new tab page)">&#8962;</button>
    <input id="fbAddr" class="fb-addr" placeholder="Search Google or type a URL" spellcheck="false" autocomplete="off" />
    <button class="fb-tb" id="fbGoBtn" title="Go">Go</button>
    <button class="fb-tb" id="fbPopBtn" title="Open direct (no proxy)">&#8599;</button>
  </div>
  <div id="fbPanes"></div>
</div>
"""

FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2338bdf8'/%3E%3Ctext x='16' y='23' font-family='Arial' font-size='19' font-weight='800' text-anchor='middle' fill='%23050505'%3EF%3C/text%3E%3C/svg%3E"

html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0c0a09" />
<title>FATE Browser</title>
<link rel="shortcut icon" href=\"""" + FAVICON + """\" type="image/x-icon" />
<script src="pass.js"></script>
<script>""" + GATE + """</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>""" + CSS + """</style>
</head>
<body>
""" + BODY + """
<script>""" + WISP + """</script>
<script>
""" + ENGINE + """
</script>
<script>
""" + BROWSER + """
</script>
</body>
</html>
"""

out1 = f"{BASE}/download/browser.html"
out2 = f"{BASE}/download/v8.2-deploy/browser.html"
open(out1, "w", encoding="utf-8").write(html)
os.makedirs(os.path.dirname(out2), exist_ok=True)
shutil.copyfile(out1, out2)
print(f"built: {out1} ({len(html)/1024:.1f} KB)")
print(f"built: {out2}")
print("deploy: drop browser.html into the SAME folder as test.html + fate-sw.js + jet files")
