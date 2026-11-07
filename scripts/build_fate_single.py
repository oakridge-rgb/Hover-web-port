#!/usr/bin/env python3
"""
FATE OS — single-file builder (stormOS style).

Packs the whole FATE site (portal, games, apps, tv, watch, music, settings,
browser shell, relay scanner + the 16.7 MB gn-math wisp engine) into ONE
self-contained HTML file:

  download/FATE.html

Architecture inside the single file:
  - FATE "OS" shell: boot splash -> access gate (same fate_v6_auth key) ->
    topbar + dock + full-viewport module views (kept alive per app).
  - Every legacy page is stored as base64 inside <script type="text/plain"
    data-fate-module="..."> and mounted as a same-origin blob: URL iframe.
  - gn-math.html engine is embedded too and decoded lazily; b.html/apps.html
    get it through window.FATE_ENGINE_URL (blob URL, same origin).
  - A bridge prelude is injected into every module:
      * window.open() override  -> routes page links back to the shell
      * capture-phase click interceptor for <a href> + inline onclick nav
      * tv/w music dock iframe fixup (s.html?mini=1 -> blob URL + #mini=1)
  - games.json is embedded as a data: URL exposed on the top window.
"""
import base64
import pathlib
import re
import sys

SITE = pathlib.Path('/home/z/my-project/download/site')
OUT_MAIN = pathlib.Path('/home/z/my-project/download/FATE.html')
OUT_COPY = pathlib.Path('/home/z/my-project/download/site/FATE.html')

SRC = {
    'index':    'index.html',
    'games':    'games.html',
    'apps':     'apps.html',
    'tv':       'tv.html',
    's':        's.html',
    'w':        'w.html',
    'settings': 'settings.html',
    'b':        'b.html',
    'scanner':  'wisp-scanner.html',
}
SMALL_MODULES = ['index', 'games', 'apps', 'tv', 's', 'w', 'settings', 'scanner', 'b']

# Fully percent-escaped SVG data URIs — safe inside double-quoted HTML attrs
# AND single-quoted JS strings (no literal quote characters at all).
LOGO = ("data:image/svg+xml,%3Csvg%20xmlns%3Dhttp%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"
        "%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22"
        "%20rx%3D%228%22%20fill%3D%22%23f59e0b%22%2F%3E%3Ctext%20x%3D%2216%22%20y%3D%2223%22"
        "%20font-family%3D%22Arial%22%20font-size%3D%2219%22%20font-weight%3D%22800%22"
        "%20text-anchor%3D%22middle%22%20fill%3D%22%23050505%22%3EF%3C%2Ftext%3E%3C%2Fsvg%3E")
PLACEHOLDER = ("data:image/svg+xml,%3Csvg%20xmlns%3Dhttp%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"
               "%20viewBox%3D%220%200%20200%20200%22%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22"
               "%20fill%3D%22%23111318%22%2F%3E%3Ctext%20x%3D%22100%22%20y%3D%22110%22"
               "%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20font-weight%3D%22700%22"
               "%20text-anchor%3D%22middle%22%20fill%3D%22%23475569%22%3EFATE%3C%2Ftext%3E%3C%2Fsvg%3E")

PRELUDE = r"""<script>
/* FATE OS bridge — injected by build_fate_single.py */
(function(){
  var T = null;
  try { T = window.top; } catch(e){}
  function g(k){ try { return T ? T[k] : null; } catch(e){ return null; } }
  window.FATE_EMBEDDED = true;
  window.FATE_MODULE_URLS = g('__FATE_MODULE_URLS') || {};
  window.FATE_ENGINE_URL = g('__FATE_ENGINE_URL') || null;
  window.FATE_GAMES_URL = g('__FATE_GAMES_URL') || null;
  window.FATE_GAMES3_URL = g('__FATE_GAMES3_URL') || null;
  window.FATE_ORIGIN = (function(){
    try {
      var L = T ? T.location : null;
      return (L && (L.protocol === 'http:' || L.protocol === 'https:')) ? L.origin + '/' : null;
    } catch(e){ return null; }
  })();
  /* catalog source: fresh copy from the server origin first, embedded as fallback */
  window.FATE_CAT_SRC = function(file){
    var emb = file === 'games.json' ? window.FATE_GAMES_URL : (file === 'games3.json' ? window.FATE_GAMES3_URL : null);
    var orig = window.FATE_ORIGIN ? window.FATE_ORIGIN + file : null;
    if (orig && emb) return [orig, emb];
    return orig || emb || file;
  };
  window.FATE_PLACEHOLDER = g('__FATE_PLACEHOLDER') || null;
  window.FATE_BOOT_URL = g('__FATE_BOOT_URL') || null;
  var PAGES = {
    'index.html':'index','games.html':'games','apps.html':'apps','tv.html':'tv',
    's.html':'s','w.html':'w','settings.html':'settings','b.html':'b',
    'wisp-scanner.html':'scanner','gn-math.html':'engine',
    'x.html':'index','e.html':'index','livetv.html':'tv','prox.html':'b','os.html':'index'
  };
  function nav(page){ try { parent.postMessage({ __fate:'nav', page:page }, '*'); } catch(e){} }
  window.FATE_NAV_FILE = function(file){
    var page = PAGES[file];
    if (!page){ try { location.href = file; } catch(e){} return; }
    if (page === 'engine') nav('b');
    else nav(page);
  };
  var wopen = window.open ? window.open.bind(window) : null;
  function classify(u){
    u = String(u == null ? '' : u);
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u) || u.slice(0,2) === '//') return null; /* absolute -> native */
    var m = /^\/?([\w.\- ]+\.html)(\?[^#]*)?(#[\s\S]*)?$/.exec(u);
    if (!m) return null;
    var page = PAGES[m[1]];
    if (!page) return null;
    if (page === 'engine'){
      var open = '';
      var mm = /#open=([^&]+)/.exec(m[3] || '') || /[?&]open=([^&]+)/.exec(m[2] || '');
      if (mm) { try { open = decodeURIComponent(mm[1]); } catch(e){ open = mm[1]; } }
      return { engine:true, url:open };
    }
    return { page:page };
  }
  window.open = function(u, t, f){
    var c = classify(u);
    if (!c) return wopen ? wopen(u, t, f) : null;
    if (c.engine){ try { parent.postMessage({ __fate:'engine_open', url:c.url }, '*'); } catch(e){} }
    else nav(c.page);
    return null;
  };
  document.addEventListener('click', function(e){
    var el = e.target;
    while (el && el.nodeType === 1 && el.nodeName !== 'A') el = el.parentNode;
    if (!el || el.nodeType !== 1) return;
    var c = classify(el.getAttribute('href') || '');
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (c.engine) nav('b');       /* gn-math links land in the browser shell */
    else nav(c.page);
  }, true);
  document.addEventListener('DOMContentLoaded', function(){
    var list = document.querySelectorAll('iframe[data-fate-mini]');
    for (var i = 0; i < list.length; i++){
      var f = list[i];
      var u = window.FATE_MODULE_URLS[f.getAttribute('data-fate-mini')];
      if (u) f.src = u + '#mini=1';
    }
  });
})();
</script>"""

SHELL = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>FATE OS</title>
<link rel="shortcut icon" href="__LOGO__" type="image/x-icon"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
:root{--primary:#f59e0b;--secondary:#ef4444;--bg:#050505;--border:rgba(255,255,255,.09);--text:#f8fafc;--muted:#94a3b8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:Inter,sans-serif;overflow:hidden}
body::before{content:'';position:fixed;inset:0;z-index:0;pointer-events:none;background:
 radial-gradient(1200px 700px at 82% -10%,rgba(245,158,11,.09),transparent 60%),
 radial-gradient(900px 600px at -10% 110%,rgba(239,68,68,.06),transparent 60%)}
.topbar{position:fixed;top:0;left:0;right:0;height:56px;z-index:30;display:none;align-items:center;gap:14px;
 padding:0 18px;background:rgba(5,5,5,.65);backdrop-filter:blur(18px) saturate(160%);border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:1.02rem}
.brand .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--primary),var(--secondary));
 display:flex;align-items:center;justify-content:center;font-weight:800;color:#050505;box-shadow:0 0 16px rgba(245,158,11,.35)}
.brand em{font-style:normal;background:linear-gradient(135deg,#fff,#fcd34d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.top-spacer{flex:1}
.clock{font-family:'Space Grotesk',sans-serif;font-size:.9rem;color:var(--muted);letter-spacing:.06em}
.panic{padding:8px 16px;border-radius:11px;border:none;cursor:pointer;font-weight:700;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
 color:#fff;background:linear-gradient(135deg,#dc2626,#991b1b);box-shadow:0 4px 16px rgba(220,38,38,.35)}
.panic:hover{filter:brightness(1.12)}
.dock{position:fixed;top:56px;bottom:0;left:0;width:88px;z-index:25;display:none;flex-direction:column;gap:6px;align-items:center;
 padding:14px 8px;overflow-y:auto;background:rgba(5,5,5,.55);backdrop-filter:blur(18px);border-right:1px solid var(--border);scrollbar-width:none}
.dock::-webkit-scrollbar{display:none}
.dbtn{width:70px;padding:9px 2px 7px;border-radius:14px;border:1px solid transparent;background:none;color:var(--muted);cursor:pointer;
 display:flex;flex-direction:column;align-items:center;gap:5px;transition:all .25s;font-family:inherit}
.dbtn svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.dbtn span{font-size:.6rem;font-weight:600;letter-spacing:.02em}
.dbtn:hover{background:rgba(245,158,11,.08);color:#fde68a}
.dbtn.active{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.35);color:var(--primary)}
.views{position:fixed;top:56px;left:88px;right:0;bottom:0;z-index:10;display:none;background:var(--bg)}
.views iframe{width:100%;height:100%;border:none;display:none;background:var(--bg)}
.views iframe.on{display:block}
.gate{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;
 background:radial-gradient(1000px 700px at 50% 18%,#0d0a06,var(--bg) 72%)}
.gate.on{display:flex}
.gate-card{width:min(92vw,380px);padding:34px 30px;border-radius:24px;background:rgba(255,255,255,.04);border:1px solid var(--border);
 backdrop-filter:blur(20px);text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.gate-logo{width:64px;height:64px;margin:0 auto 16px;border-radius:18px;background:linear-gradient(135deg,var(--primary),var(--secondary));
 display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:30px;color:#050505;
 box-shadow:0 0 40px rgba(245,158,11,.45)}
.gate-card h1{font-family:'Space Grotesk',sans-serif;font-size:1.5rem;font-weight:800;letter-spacing:.02em}
.gate-card p{color:var(--muted);font-size:.82rem;margin:6px 0 22px}
.gate-card input{width:100%;padding:13px 16px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid var(--border);
 color:var(--text);font-size:1rem;outline:none;text-align:center;letter-spacing:.2em;font-family:inherit}
.gate-card input:focus{border-color:rgba(245,158,11,.45);box-shadow:0 0 0 3px rgba(245,158,11,.12)}
.gate-card button{width:100%;margin-top:12px;padding:13px;border-radius:13px;border:none;cursor:pointer;font-weight:700;font-size:.92rem;
 color:#050505;background:linear-gradient(135deg,var(--primary),#d97706);font-family:inherit}
.gate-err{color:var(--secondary);font-size:.78rem;min-height:1.1em;margin-top:10px}
.shake{animation:shake .4s}
@keyframes shake{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
.boot{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
 background:var(--bg);transition:opacity .45s}
.boot.hidden{opacity:0;pointer-events:none}
.boot .gate-logo{animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 70px rgba(245,158,11,.7);transform:scale(1.05)}}
.boot small{color:var(--muted);letter-spacing:.14em;text-transform:uppercase;font-size:.68rem}
.unpack{position:fixed;top:56px;left:88px;right:0;bottom:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;
 gap:14px;background:var(--bg)}
.unpack.on{display:flex}
.unpack .ring{width:44px;height:44px;border-radius:50%;border:3px solid rgba(245,158,11,.2);border-top-color:var(--primary);animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.unpack p{color:var(--muted);font-size:.85rem}
@media(max-width:820px){
 .dock{top:auto;bottom:0;left:0;right:0;width:auto;height:74px;flex-direction:row;justify-content:flex-start;
  padding:8px 10px;border-right:none;border-top:1px solid var(--border);overflow-x:auto;overflow-y:hidden}
 .dbtn{min-width:64px;flex:0 0 auto}
 .views{left:0;bottom:74px}
 .unpack{left:0;bottom:74px}
}
</style>
</head>
<body>
<div class="boot" id="fateBoot"><div class="gate-logo">F</div><small id="bootTxt">unpacking FATE OS</small></div>
<div class="gate" id="fateGate">
 <div class="gate-card" id="gateCard">
  <div class="gate-logo">F</div>
  <h1>FATE OS</h1>
  <p>the whole site in one file &mdash; portal &middot; games &middot; tv &middot; music &middot; browser</p>
  <input id="gatePass" type="password" placeholder="access password" autocomplete="off"/>
  <button id="gateGo">Unlock</button>
  <div class="gate-err" id="gateErr"></div>
 </div>
</div>
<div class="topbar" id="fateTop">
 <div class="brand"><div class="logo">F</div><span><em>FATE</em>&nbsp;OS</span></div>
 <div class="top-spacer"></div>
 <div class="clock" id="fateClock"></div>
 <button class="panic" id="fatePanic">Panic</button>
</div>
<nav class="dock" id="fateDock"></nav>
<div class="unpack" id="fateUnpack"><div class="ring"></div><p>unpacking the wisp engine&hellip;</p></div>
<main class="views" id="fateViews"></main>

__MODULE_TAGS__
<script type="text/plain" data-fate-data="games">__GAMES_B64__</script>
__GAMES3_TAG__
<script type="text/plain" data-fate-module="engine">__ENGINE_B64__</script>
<script>
(function(){
'use strict';
var AUTH_KEY = 'fate_v6_auth';
var PASSES = ['fate2026'];
var SMALL = ['index','games','apps','tv','s','w','settings','scanner','b'];
var PAGE_FILE = {index:1,games:1,apps:1,tv:1,s:1,w:1,settings:1,scanner:1,b:1};
var PAGES = [
  {id:'index',   label:'Home',     d:'M3 11l9-8 9 8M5 10v10h4v-6h6v6h4V10'},
  {id:'games',   label:'Games',    d:'M6 12h4M8 10v4M15 11h.01M18 13h.01M17.3 5H6.7a4.7 4.7 0 0 0-4.6 5.6l1 5.4a2.8 2.8 0 0 0 4.9 1.2L9.5 15h5l1.5 2.2a2.8 2.8 0 0 0 4.9-1.2l1-5.4A4.7 4.7 0 0 0 17.3 5z'},
  {id:'apps',    label:'Apps',     d:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'},
  {id:'tv',      label:'Live TV',  d:'M3 7h18v11H3zM8 3l4 4 4-4'},
  {id:'w',       label:'Watch',    d:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8l6 4-6 4z'},
  {id:'s',       label:'Music',    d:'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'},
  {id:'b',       label:'Browser',  d:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18'},
  {id:'scanner', label:'Relay',    d:'M3 12h4l3-8 4 16 3-8h4'},
  {id:'settings',label:'Settings', d:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'}
];
var MODULE_URLS = {}, ENGINE_URL = null, enginePromise = null, CURRENT = null;
var FRAMES = {};
function $(id){ return document.getElementById(id); }
function hash(s){ var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function authed(){
  try {
    var v = localStorage.getItem(AUTH_KEY);
    var list = PASSES.map(hash);
    return !!v && list.indexOf(v) > -1;
  } catch(e){ return false; }
}
function b64Bytes(b64){
  b64 = b64.replace(/\s+/g, '');
  var pad = b64.slice(-2) === '==' ? 2 : (b64.slice(-1) === '=' ? 1 : 0);
  var out = new Uint8Array(Math.floor(b64.length / 4) * 3 - pad);
  var CH = 4194304;
  for (var i = 0; i < b64.length; i += CH){
    var bin = atob(b64.substr(i, CH));
    var start = Math.floor(i / 4) * 3;
    for (var j = 0; j < bin.length; j++) out[start + j] = bin.charCodeAt(j);
  }
  return out;
}
function modTag(name){
  var el = document.querySelector('script[data-fate-module="' + name + '"]');
  return el ? el.textContent : '';
}
function blobURLof(b64, mime){
  return URL.createObjectURL(new Blob([b64Bytes(b64)], { type: mime }));
}
function buildSmallModules(){
  for (var i = 0; i < SMALL.length; i++){
    var id = SMALL[i];
    if (!MODULE_URLS[id]) MODULE_URLS[id] = blobURLof(modTag(id), 'text/html');
  }
  try {
    var g = document.querySelector('script[data-fate-data="games"]');
    if (g && !window.__FATE_GAMES_URL) window.__FATE_GAMES_URL = 'data:application/json;base64,' + g.textContent.replace(/\s+/g, '');
    var g3 = document.querySelector('script[data-fate-data="games3"]');
    if (g3 && !window.__FATE_GAMES3_URL) window.__FATE_GAMES3_URL = 'data:application/json;base64,' + g3.textContent.replace(/\s+/g, '');
  } catch(e){}
  window.__FATE_MODULE_URLS = MODULE_URLS;
  window.__FATE_ENGINE_URL = ENGINE_URL;
  window.__FATE_PLACEHOLDER = '__PLACEHOLDER__';
}
function buildEngine(){
  if (ENGINE_URL) return Promise.resolve(ENGINE_URL);
  if (!enginePromise){
    enginePromise = new Promise(function(res){
      setTimeout(function(){
        ENGINE_URL = blobURLof(modTag('engine'), 'text/html');
        window.__FATE_ENGINE_URL = ENGINE_URL;
        res(ENGINE_URL);
      }, 60);
    });
  }
  return enginePromise;
}
function mount(id){
  var el = $('fateViews');
  if (!FRAMES[id]){
    var f = document.createElement('iframe');
    f.title = id;
    f.setAttribute('allow', 'fullscreen; clipboard-read; clipboard-write; autoplay; encrypted-media');
    f.setAttribute('allowfullscreen', '');
    f.dataset.page = id;
    el.appendChild(f);
    FRAMES[id] = f;
    f.src = MODULE_URLS[id];
  }
  for (var k in FRAMES) FRAMES[k].classList.toggle('on', k === id);
  CURRENT = id;
  var btns = document.querySelectorAll('.dbtn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].dataset.page === id);
}
function showModule(id){
  if (!PAGE_FILE[id]) return;
  if (id === 'b' || id === 'apps'){
    $('fateUnpack').classList.add('on');
    buildEngine().then(function(){
      $('fateUnpack').classList.remove('on');
      if (CURRENT === id) return;
      mount(id);
    });
    return;
  }
  mount(id);
}
function buildDock(){
  var dock = $('fateDock');
  for (var i = 0; i < PAGES.length; i++){
    var p = PAGES[i];
    var b = document.createElement('button');
    b.className = 'dbtn';
    b.dataset.page = p.id;
    b.title = p.label;
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + p.d + '"/></svg><span></span>';
    b.querySelector('span').textContent = p.label;
    b.addEventListener('click', function(ev){ showModule(ev.currentTarget.dataset.page); });
    dock.appendChild(b);
  }
}
function clock(){
  var el = $('fateClock');
  function t(){
    var d = new Date();
    el.textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  t();
  setInterval(t, 20000);
}
function initOS(){
  $('bootTxt').textContent = 'decoding modules';
  buildSmallModules();
  $('fateBoot').classList.add('hidden');
  $('fateGate').classList.remove('on');
  $('fateTop').style.display = 'flex';
  $('fateDock').style.display = 'flex';
  $('fateViews').style.display = 'block';
  buildDock();
  clock();
  var h = location.hash || '';
  var mopen = /^#open=(.+)$/.exec(h);
  var mpage = /^#([a-z]+)$/.exec(h);
  if (mopen){
    window.__FATE_BOOT_URL = null;
    try { window.__FATE_BOOT_URL = decodeURIComponent(mopen[1]); } catch(e){ window.__FATE_BOOT_URL = mopen[1]; }
    showModule('b');
  } else if (mpage && PAGE_FILE[mpage[1]]){
    showModule(mpage[1]);
  } else {
    showModule('index');
  }
  setTimeout(function(){ buildEngine(); }, 1500); /* prewarm the engine */
}
window.addEventListener('message', function(e){
  var d = e.data;
  if (!d || typeof d !== 'object' || !d.__fate) return;
  if (d.__fate === 'nav' && PAGE_FILE[d.page]) showModule(d.page);
  else if (d.__fate === 'engine_open'){
    if (!ENGINE_URL) return;
    var u = ENGINE_URL;
    if (d.url) u += '#open=' + encodeURIComponent(d.url);
    window.open(u, '_blank');
  }
});
$('gateGo').addEventListener('click', tryUnlock);
$('gatePass').addEventListener('keydown', function(e){ if (e.key === 'Enter') tryUnlock(); });
function tryUnlock(){
  var p = $('gatePass').value || '';
  if (PASSES.map(hash).indexOf(hash(p)) > -1){
    try { localStorage.setItem(AUTH_KEY, hash(p)); } catch(e){}
    initOS();
  } else {
    $('gateErr').textContent = 'wrong password';
    var c = $('gateCard');
    c.classList.remove('shake');
    void c.offsetWidth;
    c.classList.add('shake');
  }
}
$('fatePanic').addEventListener('click', function(){ location.replace('https://clever.com'); });
window.addEventListener('hashchange', function(){
  var m = /^#open=(.+)$/.exec(location.hash || '');
  if (!m) return;
  var u;
  try { u = decodeURIComponent(m[1]); } catch(e){ u = m[1]; }
  showModule('b');
  var f = FRAMES['b'];
  var sent = false;
  if (f && f.contentWindow){
    try { f.contentWindow.postMessage({ __fate:'boot', url:u }, '*'); sent = true; } catch(e){}
  }
  if (!sent) window.__FATE_BOOT_URL = u; /* fresh boot: prelude picks it up */
});
window.addEventListener('DOMContentLoaded', function(){
  if (authed()) initOS();
  else { $('fateBoot').classList.add('hidden'); $('fateGate').classList.add('on'); try { $('gatePass').focus(); } catch(e){} }
});
})();
</script>
</body>
</html>
"""

PAGE_ID_TO_FILE = {
    'b': 'b.html', 'scanner': 'wisp-scanner.html',
    'index': 'index.html', 'games': 'games.html', 'apps': 'apps.html',
    'tv': 'tv.html', 's': 's.html', 'w': 'w.html', 'settings': 'settings.html',
}


def patch(name, html):
    subs = []
    if name == 'b':
        subs.append((
            "const ENGINE_URL = 'gn-math.html';",
            "const ENGINE_URL = (window.FATE_ENGINE_URL || 'gn-math.html');",
        ))
        subs.append((
            "newTab();\npaintChip();",
            "newTab();\nif (window.FATE_BOOT_URL) { try { navigate(TABS[0], window.FATE_BOOT_URL); } catch(e){} }\n"
            "window.addEventListener('message', function(e){ var d = e.data; if (!d || typeof d !== 'object' || d.__fate !== 'boot') return;"
            " try { navigate(TABS[0], String(d.url || '')); } catch(err){} });\n"
            "paintChip();",
        ))
    if name == 'apps':
        subs.append((
            "var src = 'gn-math.html#open=' + encodeURIComponent(app.url);",
            "var src = (window.FATE_ENGINE_URL || 'gn-math.html') + '#open=' + encodeURIComponent(app.url);",
        ))
        subs.append((
            "try { frame.contentWindow.location.href = 'gn-math.html#open='",
            "try { frame.contentWindow.location.href = (window.FATE_ENGINE_URL || 'gn-math.html') + '#open='",
        ))
        subs.append((
            "catch (err) { frame.src = 'gn-math.html#open='",
            "catch (err) { frame.src = (window.FATE_ENGINE_URL || 'gn-math.html') + '#open='",
        ))
    if name in ('games', 'index'):
        subs.append(("url: 'games.json'", "url: FATE_CAT_SRC('games.json')"))
        subs.append(("url: 'games3.json'", "url: FATE_CAT_SRC('games3.json')"))
        subs.append((
            "const res = await fetchWithTimeout(src.url);\n        if (!res.ok) throw new Error('HTTP ' + res.status);",
            "const _cands = Array.isArray(src.url) ? src.url : [src.url];\n"
            "        let res = null, _err = null;\n"
            "        for (const _cu of _cands){\n"
            "          try { const _r = await fetchWithTimeout(_cu); if (_r.ok){ res = _r; break; } _err = new Error('HTTP ' + _r.status); }\n"
            "          catch(e){ _err = e; }\n"
            "        }\n"
            "        if (!res) throw (_err || new Error('unavailable'));",
        ))
        subs.append((
            "if(src.base) return src.base + u;\n  return u;",
            "if(src.base) return src.base + u;\n  return (window.FATE_ORIGIN || '') + u;",
        ))
    if name == 's':
        subs.append((
            "if(location.search.indexOf('mini=1')>-1)",
            "if(location.search.indexOf('mini=1')>-1||location.hash.indexOf('mini=1')>-1)",
        ))
    if name in ('tv', 'w'):
        subs.append((
            '<iframe id="musicDock" src="s.html?mini=1" allow="autoplay" title="FATE Music"></iframe>',
            '<iframe id="musicDock" data-fate-mini="s" src="about:blank" allow="autoplay" title="FATE Music"></iframe>',
        ))
    for old, new in subs:
        n = html.count(old)
        assert n == 1, f'[{name}] pattern count={n} (want 1): {old[:70]!r}'
        html = html.replace(old, new)
    # route bare-filename location navigations through the bridge (inline
    # onclick handlers and JS assignments can never resolve against blob:)
    n_nav = 0
    def _nav(m):
        nonlocal n_nav
        n_nav += 1
        return f"FATE_NAV_FILE('{m.group(1)}')"
    html = re.sub(r"location\.href\s*=\s*'([\w.\-]+\.html)'", _nav, html)
    html = re.sub(r"location\.replace\s*\(\s*'([\w.\-]+\.html)'\s*\)", _nav, html)
    n_logo = html.count('media/logo.svg')
    n_ph = html.count('media/placeholder.svg')
    html = html.replace('media/logo.svg', LOGO).replace('media/placeholder.svg', PLACEHOLDER)
    print(f'  [{name}] {len(subs)} code patches, {n_nav} nav rewrites, {n_logo} logo refs, {n_ph} placeholder refs inlined')
    return html


def b64_wrap(data: bytes, width: int = 500000) -> str:
    raw = base64.b64encode(data).decode('ascii')
    return '\n'.join(raw[i:i + width] for i in range(0, len(raw), width))


def main():
    print('== FATE OS single-file builder ==')
    modules = {}
    for pid, fname in PAGE_ID_TO_FILE.items():
        src = SITE / fname
        html = src.read_text(encoding='utf-8')
        assert html.count('<head>') == 1, f'{fname}: <head> not found exactly once'
        html = patch(pid, html)
        html = html.replace('<head>', '<head>' + PRELUDE, 1)
        modules[pid] = html
        print(f'  {fname}: {len(html)/1024:.0f} KB after patch')

    games_b64 = b64_wrap((SITE / 'games.json').read_bytes())
    engine_b64 = b64_wrap((SITE / 'gn-math.html').read_bytes())
    print(f'  games.json -> {len(games_b64)/1024:.0f} KB b64, engine -> {len(engine_b64)/1024/1024:.1f} MB b64')
    g3_path = SITE / 'games3.json'
    games3_tag = ''
    if g3_path.exists():
        g3_b64 = b64_wrap(g3_path.read_bytes())
        games3_tag = '<script type="text/plain" data-fate-data="games3">' + g3_b64 + '</script>'
        print(f'  games3.json embedded ({len(g3_b64)/1024:.0f} KB b64)')
    else:
        print('  games3.json not in site/ -> single file will fetch it from the server origin (put it next to FATE.html)')

    tags = []
    for pid in ['index', 'games', 'apps', 'tv', 's', 'w', 'settings', 'b', 'scanner']:
        b64 = b64_wrap(modules[pid].encode('utf-8'))
        tags.append(f'<script type="text/plain" data-fate-module="{pid}">{b64}</script>')

    doc = (SHELL
           .replace('__MODULE_TAGS__', '\n'.join(tags))
           .replace('__GAMES_B64__', games_b64)
           .replace('__GAMES3_TAG__', games3_tag)
           .replace('__ENGINE_B64__', engine_b64)
           .replace('__LOGO__', LOGO)
           .replace('__PLACEHOLDER__', PLACEHOLDER))

    OUT_MAIN.write_text(doc, encoding='utf-8')
    OUT_COPY.write_text(doc, encoding='utf-8')
    print(f'== wrote {OUT_MAIN} ({OUT_MAIN.stat().st_size/1024/1024:.1f} MB) + copy in site/ ==')


if __name__ == '__main__':
    sys.exit(main())
