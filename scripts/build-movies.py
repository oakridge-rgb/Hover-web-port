#!/usr/bin/env python3
# build-movies.py — FATE Movies: a dedicated movies-only page next to the v8.2 portal.
# Reuses the SAME folder: fate-sw.js + jet.* (already hosted for test.html) — zero new deps.
# Lanes: (1) jet-browse streaming sites (Aether/Tubi/Archive/YouTube), (2) free movie
# vault from IPTV m3u lists (movie groups only), (3) instant m3u8/mp4 paste player.
import os, sys, shutil

BASE = "/home/z/my-project"
ENGINE = open(f"{BASE}/scripts/jet-engine.js", encoding="utf-8").read()
MOVIES = open(f"{BASE}/scripts/movies-engine.js", encoding="utf-8").read()

# ---- patch the jet engine for the movies page: movie-site shortcuts ----
START = "/* exact reference SHORTCUTS set */"
END = "let FATE_JET = null;"
if START not in ENGINE or END not in ENGINE or ENGINE.index(START) > ENGINE.index(END):
    print("FAIL: jet engine anchors missing"); sys.exit(1)
MOVIE_APPS = """/* movie-site shortcut set (FATE Movies page) */
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
"""
ENGINE = ENGINE[:ENGINE.index(START)] + MOVIE_APPS + ENGINE[ENGINE.index(END):]

def must_swap(old, new, label):
    global ENGINE
    if old not in ENGINE:
        print(f"FAIL: engine anchor missing [{label}]"); sys.exit(1)
    ENGINE = ENGINE.replace(old, new)
    print(f"ok: engine patch [{label}]")

must_swap(" FATE Apps</h3>", " Movie Sites</h3>", "modal title")
must_swap("Real sites through the wisp tunnel \\u2014 jet files load local-first, mirror fallback",
          "Opens through the wisp tunnel \\u2014 keep this tab foreground on iPad",
          "modal subtitle")

# ---- host-side wisp lane engine (same lane cache key as the portal) ----
WISP = r"""
/* ===== FATE MOVIES WISP LANE HOST (shared fate_wisp_lane_v6 cache with the portal) ===== */
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
      console.log('[FATE MOVIES] wisp transport READY - lane', window.wlspServer, '- assets', base);
      return t;
    }catch(e){ console.warn('[FATE MOVIES] transport base failed:', base, (e && e.message) || e); }
  }
  console.warn('[FATE MOVIES] no asset base could serve curl/index.mjs');
  return null;
}
/* ===== END WISP LANE HOST ===== */
"""

# ---- video engine loader (from FATE TV: hls.js + artplayer mirror chains) ----
LIBS = r"""
(function(){
  var HLS_SOURCES=[
    '/hls.min.js/',
    'https://gcore.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://testingcf.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://fastly.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://unpkg.com/hls.js@1/dist/hls.min.js'
  ];
  var ART_SOURCES=[
    '/artplayer.js/',
    'https://gcore.jsdelivr.net/npm/artplayer@5/dist/artplayer.js',
    'https://testingcf.jsdelivr.net/npm/artplayer@5/dist/artplayer.js',
    'https://fastly.jsdelivr.net/npm/artplayer@5/dist/artplayer.js',
    'https://unpkg.com/artplayer@5/dist/artplayer.js'
  ];
  window.fateEngine={hls:null,art:null};
  function loadChain(srcs,i,which){
    return new Promise(function(resolve,reject){
      if(i>=srcs.length)return reject(new Error('all sources failed'));
      var s=document.createElement('script');
      s.src=srcs[i];
      s.onload=function(){window.fateEngine[which]=srcs[i];resolve(srcs[i])};
      s.onerror=function(){s.remove();loadChain(srcs,i+1,which).then(resolve,reject)};
      document.head.appendChild(s);
    });
  }
  window.fateTVLibs='loading';
  window.fateTVLibsReady=Promise.all([
    loadChain(HLS_SOURCES,0,'hls'),
    loadChain(ART_SOURCES,0,'art')
  ]);
  window.fateTVLibsReady.then(function(){ window.fateTVLibs='ok'; }).catch(function(){ window.fateTVLibs='failed'; });
})();
"""

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

CSS = """
:root{--primary:#f59e0b;--secondary:#ef4444;--accent:#10b981;--bg-deep:#050505;--glass:rgba(0,0,0,0.55);--glass-border:rgba(255,255,255,0.1);--text:#f8fafc;--text-muted:#cbd5e1}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg-deep);color:var(--text);font-family:"Inter",sans-serif;min-height:100vh;overflow-x:hidden;padding-top:80px}
.bg-image{position:fixed;inset:0;z-index:0;background:url("/img/background.png") center center/cover no-repeat}
.bg-overlay{position:fixed;inset:0;z-index:1;background:rgba(5,5,5,0.55);backdrop-filter:blur(4px)}
.nav-glass{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(5,5,5,0.6);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--glass-border);padding:16px 24px}
.nav-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:10px}
.nav-brand{display:flex;align-items:center;gap:12px}
.nav-logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(245,158,11,0.4);flex-shrink:0}
.nav-logo span{font-weight:800;font-size:18px;color:white;font-family:"Space Grotesk",sans-serif}
.nav-title{font-family:"Space Grotesk",sans-serif;font-size:1.25rem;font-weight:700;background:linear-gradient(135deg,#fff,#fcd34d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;white-space:nowrap}
.nav-links{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.nav-link{padding:10px 20px;border-radius:12px;font-weight:500;color:var(--text-muted);text-decoration:none;display:flex;align-items:center;gap:8px;transition:all .3s cubic-bezier(.4,0,.2,1);background:none;border:none;cursor:pointer;font-family:inherit;font-size:.9rem}
.nav-link:hover{background:rgba(245,158,11,0.1);color:#fff}
.panic-btn{padding:10px 20px;border-radius:12px;background:linear-gradient(135deg,#dc2626,#991b1b);color:white;font-weight:700;font-size:.85rem;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(220,38,38,0.4);transition:all .3s ease;text-transform:uppercase;letter-spacing:.5px}
.panic-btn:hover{transform:scale(1.05);box-shadow:0 8px 30px rgba(220,38,38,0.6)}
.main{position:relative;z-index:4;max-width:1200px;margin:0 auto;padding:40px 24px 80px}
.page-header{text-align:center;margin-bottom:2.25rem}
.page-header h1{font-family:"Space Grotesk",sans-serif;font-size:clamp(2.5rem,8vw,4rem);font-weight:800;letter-spacing:-.02em;background:linear-gradient(135deg,#fff 0%,#fcd34d 50%,#a78bfa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.page-header p{color:var(--text-muted);margin-top:.5rem;font-size:1rem}
.fm-url-row{max-width:760px;margin:0 auto 1.75rem;display:flex;gap:.75rem;align-items:center}
.fm-url-row .search-input{flex:1;margin:0}
.search-input{width:100%;padding:16px 24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;color:var(--text);font-size:1rem;outline:none;transition:all .3s ease;font-family:inherit}
.search-input:focus{border-color:rgba(245,158,11,0.4);box-shadow:0 0 0 3px rgba(245,158,11,0.1),0 10px 40px rgba(245,158,11,0.1)}
.search-input::placeholder{color:#64748b}
.fm-playbtn{padding:16px 26px;border-radius:16px;border:none;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;font-weight:800;font-size:.95rem;cursor:pointer;white-space:nowrap;box-shadow:0 8px 25px rgba(245,158,11,0.35);transition:all .3s ease;font-family:inherit}
.fm-playbtn:hover{transform:translateY(-2px);box-shadow:0 12px 35px rgba(245,158,11,0.5)}
.stats-bar{display:flex;justify-content:center;align-items:center;gap:1.5rem;margin-bottom:2rem;flex-wrap:wrap;color:var(--text-muted);font-size:.875rem}
.stat{display:flex;align-items:center;gap:6px}
.stat svg{width:16px;height:16px;fill:var(--primary)}
.fm-h3{font-family:"Space Grotesk",sans-serif;font-size:1.15rem;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:1rem}
.fm-h3 svg{width:18px;height:18px;fill:var(--primary)}
.fm-h3 .cnt{font-size:.72rem;font-weight:700;color:#c4b5fd;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.35);padding:3px 10px;border-radius:20px}
section{margin-bottom:2.5rem}
.site-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
.site-card{position:relative;display:flex;flex-direction:column;gap:.4rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:1.25rem;cursor:pointer;transition:all .35s cubic-bezier(.4,0,.2,1);overflow:hidden}
.site-card:hover{transform:translateY(-6px);border-color:rgba(167,139,250,0.45);box-shadow:0 18px 40px rgba(0,0,0,0.45),0 0 40px rgba(167,139,250,0.12)}
.site-card .ic{width:52px;height:52px;border-radius:14px;background:rgba(0,0,0,0.5);display:grid;place-items:center;margin-bottom:.35rem}
.site-card .lbl{font-weight:800;font-size:1.05rem;font-family:"Space Grotesk",sans-serif}
.site-card .desc{color:var(--text-muted);font-size:.8rem;line-height:1.45}
.site-card .via{margin-top:.4rem;font-size:.64rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a78bfa;opacity:.75}
.site-card.hero{grid-column:span 2;background:linear-gradient(135deg,rgba(167,139,250,0.14),rgba(99,102,241,0.05));border-color:rgba(167,139,250,0.35)}
.site-card.hero .lbl{font-size:1.35rem;background:linear-gradient(135deg,#fff,#c4b5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
@media(max-width:700px){.site-card.hero{grid-column:span 1}}
.vault-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1rem}
@media(max-width:640px){.vault-grid{grid-template-columns:repeat(auto-fill,minmax(118px,1fr))}}
.vault-card{position:relative;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;cursor:pointer;transition:all .35s cubic-bezier(.4,0,.2,1)}
.vault-card:hover{transform:translateY(-6px) scale(1.02);border-color:rgba(245,158,11,0.35);box-shadow:0 18px 40px rgba(0,0,0,0.45),0 0 35px rgba(245,158,11,0.1)}
.fm-poster{position:relative;aspect-ratio:2/3;background:linear-gradient(135deg,#1a1a2e,#0f0f1a);display:grid;place-items:center;overflow:hidden}
.fm-letter{position:absolute;font-family:"Space Grotesk",sans-serif;font-size:2.6rem;font-weight:800;color:rgba(245,158,11,0.35)}
.fm-poster img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2}
.fm-name{padding:9px 10px 3px;font-size:.8rem;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.fm-group{padding:0 10px 10px;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.6px;text-align:center;color:#a78bfa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.load-more-wrap{text-align:center;padding:2rem 1rem}
.load-more-btn{padding:14px 32px;border-radius:30px;background:linear-gradient(135deg,rgba(167,139,250,0.2),rgba(245,158,11,0.2));border:1px solid rgba(167,139,250,0.35);color:var(--text);font-weight:600;cursor:pointer;transition:all .3s ease;display:inline-flex;align-items:center;gap:10px;font-family:inherit}
.load-more-btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(167,139,250,0.2)}
.empty{text-align:center;padding:3rem 2rem;color:var(--text-muted);grid-column:1/-1}
.empty svg{width:64px;height:64px;fill:#334155;margin-bottom:1rem}
.skeleton-img{background:linear-gradient(90deg,#1a1a2e 25%,#252538 50%,#1a1a2e 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(30px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
.hidden{display:none!important}
/* ---- player modal (portal popup style) ---- */
.popup-overlay{position:fixed;inset:0;z-index:9998;background:rgba(5,5,5,0.95);backdrop-filter:blur(10px);display:none;align-items:center;justify-content:center;padding:20px}
.popup-overlay.open{display:flex;animation:fadeIn .3s ease}
.popup-box{width:100%;max-width:1200px;height:86vh;background:rgba(10,10,10,0.95);border-radius:24px;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--glass-border);box-shadow:0 25px 50px rgba(0,0,0,0.5);animation:slideUp .4s cubic-bezier(.4,0,.2,1)}
.popup-header{padding:16px 24px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--glass-border);gap:12px}
.popup-titles{flex:1;min-width:0}
.popup-title{font-family:"Space Grotesk",sans-serif;font-size:1.1rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.popup-sub{color:var(--text-muted);font-size:.75rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.popup-actions{display:flex;gap:10px}
.popup-btn{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s ease;font-size:.9rem;flex-shrink:0}
.popup-btn:hover{background:rgba(245,158,11,0.2);border-color:rgba(245,158,11,0.4)}
.popup-btn.close:hover{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.4)}
.popup-content{flex:1;position:relative;background:#000}
#fmPlayer{width:100%;height:100%}
#fmPlayer .art-video-player{width:100%;height:100%}
.fm-status{position:absolute;inset:0;z-index:5;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(5,5,5,0.88);text-align:center;padding:2rem}
.fm-status.show{display:flex}
.fm-spin{width:44px;height:44px;border:3px solid rgba(245,158,11,0.2);border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite}
#fmStatusText{color:var(--text);font-weight:600;font-size:.95rem;max-width:520px;line-height:1.5}
#fmStatusActs{display:none;gap:.75rem}
.fm-act{padding:10px 22px;border-radius:12px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.12);color:#fcd34d;font-weight:700;font-size:.85rem;cursor:pointer;font-family:inherit}
.fm-act:hover{background:rgba(245,158,11,0.25)}
.fm-chip{padding:8px 14px;border-radius:12px;font-size:.72rem;font-weight:700;border:1px solid rgba(148,163,184,.25);white-space:nowrap;background:rgba(0,0,0,0.4)}
@media(max-width:768px){
  body{padding-top:72px}
  .nav-glass{padding:12px 14px}
  .nav-title{font-size:1.05rem}
  .nav-link{padding:8px 12px;font-size:.82rem}
  .panic-btn{padding:8px}
  .panic-btn span{display:none}
  .fm-url-row{flex-direction:column}
  .fm-playbtn{width:100%}
  .main{padding:28px 14px 60px}
}
"""

BODY = """
<div class="bg-image"></div><div class="bg-overlay"></div>
<nav class="nav-glass"><div class="nav-inner">
  <div class="nav-brand">
    <div class="nav-logo"><span>F</span></div>
    <div class="nav-title">FATE Movies</div>
  </div>
  <div class="nav-links">
    <span class="fm-chip" id="fmJetChip">tunnel: idle</span>
    <button class="nav-link" onclick="fateToggleApps()" title="All movie sites (through the tunnel)">Sites</button>
    <a class="nav-link" href="test.html" title="Back to the FATE portal">Portal</a>
    <button class="panic-btn" onclick="location.replace('index.html')" title="Emergency exit"><span>Panic</span></button>
  </div>
</div></nav>
<main class="main">
  <div class="page-header">
    <h1>FATE Movies</h1>
    <p>Streaming sites through your wisp tunnel + a free movie vault + instant player &mdash; no games, just cinema.</p>
  </div>

  <div class="fm-url-row">
    <input id="fmCustomUrl" class="search-input" placeholder="Paste any .m3u8 or .mp4 link and hit Play&hellip;" spellcheck="false" />
    <button class="fm-playbtn" onclick="fmPlayCustom()">&#9654; Play</button>
  </div>

  <div class="stats-bar">
    <span class="stat" id="fmVaultStats">loading vault&hellip;</span>
  </div>

  <section>
    <h3 class="fm-h3"><svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg> Stream sites <span class="cnt">jet tunnel</span></h3>
    <div class="site-grid" id="fmSiteGrid"></div>
  </section>

  <section>
    <h3 class="fm-h3"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4-6 4z"/></svg> Free movie vault</h3>
    <div class="fm-url-row" style="margin-bottom:1.25rem">
      <input id="fmSearch" class="search-input" placeholder="Search the vault&hellip;" spellcheck="false" />
    </div>
    <div class="vault-grid" id="fmVaultGrid"></div>
    <div class="load-more-wrap"><button class="load-more-btn" id="fmMoreBtn" onclick="fmRenderMore()" style="display:none">Load more</button></div>
  </section>
</main>

<div class="popup-overlay" id="movieModal">
  <div class="popup-box">
    <div class="popup-header">
      <div class="popup-titles">
        <div class="popup-title" id="fmPlayerTitle">Movie</div>
        <div class="popup-sub" id="fmPlayerSub"></div>
      </div>
      <div class="popup-actions">
        <button class="popup-btn" onclick="fmRetry()" title="Retry stream">&#10227;</button>
        <button class="popup-btn" onclick="fmNext()" title="Random other movie">&#9197;</button>
        <button class="popup-btn close" onclick="fmClosePlayer()" title="Close">&#10005;</button>
      </div>
    </div>
    <div class="popup-content">
      <div id="fmPlayer"></div>
      <div class="fm-status" id="fmStatus">
        <div class="fm-spin"></div>
        <span id="fmStatusText">Connecting&hellip;</span>
        <div id="fmStatusActs">
          <button class="fm-act" onclick="fmRetry()">&#10227; Retry</button>
          <button class="fm-act" onclick="fmNext()">&#9197; Next movie</button>
        </div>
      </div>
    </div>
  </div>
</div>
"""

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>FATE Movies</title>
<link rel="shortcut icon" href="media/logo.svg" type="image/x-icon" />
<script src="pass.js"></script>
<script>{GATE}</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>{CSS}</style>
<script>{LIBS}</script>
</head>
<body>
{BODY}
<script>{WISP}</script>
<script>
{ENGINE}
</script>
<script>
{MOVIES}
</script>
</body>
</html>
"""

out1 = f"{BASE}/download/movies.html"
out2 = f"{BASE}/download/v8.2-deploy/movies.html"
open(out1, "w", encoding="utf-8").write(html)
os.makedirs(os.path.dirname(out2), exist_ok=True)
shutil.copyfile(out1, out2)
print(f"built: {out1} ({len(html)/1024:.1f} KB)")
print(f"built: {out2}")
print("deploy: drop movies.html into the SAME folder as test.html + fate-sw.js + jet files")
