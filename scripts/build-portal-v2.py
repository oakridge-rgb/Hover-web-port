#!/usr/bin/env python3
"""Build download/fate-portal-v2.html from upload/test.html.

Ports the FULL v2 cloud stack (all fixes from app tasks 3-6) into the user's
static portal page:
  - mirror sweep: /stratus/games fired at ALL 9 mirrors in parallel, first
    non-empty catalog wins, winner pinned (was: single hardcoded mirror)
  - retry ladder: GET x3 / POST x2 with backoff, transient-only (backend
    flaps per-request; one hang no longer kills the flow)
  - saved catalog: never blank, outlives mirror rotations and outages,
    rendered instantly; stale catalog shown with honest status
  - non-blocking merge: the page renders the regular catalog immediately;
    cloud games pop in when the sweep lands (page no longer stalls on a
    dead CDN)
  - RELOAD GAMES button in the cloud section header (manual sweep)
  - background auto-retry every 20s until cloud games arrive
  - queue polling tolerates transient errors; broken cover imgs hidden
  - build marker: console log + footer chip so the user can VERIFY the
    new build is actually deployed (their stale-download complaint)
"""

SRC = "/home/z/my-project/upload/test.html"
DST = "/home/z/my-project/download/fate-portal-v2.html"

BUILD = "2026-10-27"

V2_BLOCK = """/* ===== FATE PORTAL v2 CLOUD STACK (build BUILDSTAMP) ===== */
console.log('%c[FATE PORTAL v2] cloud stack build BUILDSTAMP - sweep + retry + cache + reload button', 'color:#22d3ee;font-weight:bold;');

const FATE_STRATUS_MIRRORS = [
  'cdn.northstreetumc.org',
  'cdn.vipersfutbol.com',
  'cdn.pcesc.org',
  'cdn.kcchallengevbc.com',
  'cdn.slcbmooc.org',
  'cdn.topstargym.net',
  'cdn.goaplytexas.org',
  'cdn.clearfieldswimming.com',
  'cdn.richardacademy.cfd'
];
const FATE_MIRROR_KEY = 'fate_stratus_mirror_v2';
const FATE_GAMES_KEY = 'fate_stratus_games_v2';
const FATE_GAMES_TTL = 10 * 60 * 1000;

function _lsGet(k){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ return null; } }
function _lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

function savedStratusMirror(){ const s = _lsGet(FATE_MIRROR_KEY); return s && s.host ? s.host : null; }

function setStratusBase(host){
  if(!host) return;
  window.FATE_STRATUS_BASE = 'https://' + host;
  _lsSet(FATE_MIRROR_KEY, { host: host, t: Date.now() });
}

/* one single-shot call against a specific mirror */
async function stratusFetch(host, path, ms){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 6500);
  try{
    const res = await fetch('https://' + host + '/stratus/' + path, { credentials: 'include', signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if(!res.ok && !data.error) data.error = 'HTTP ' + res.status;
    return data;
  }finally{ clearTimeout(t); }
}

const FATE_TRANSIENT = /abort|failed to fetch|network ?error|timed? ?out/i;

/* stratusApi's retry ladder (v2) lives at the original stratusApi site below;
   nothing needed here. */

/* resolve with the first non-null promise result (fastest live mirror wins) */
function _raceFirst(ps){
  return new Promise(resolve => {
    let settled = 0, done = false;
    ps.forEach(p => p.then(v => {
      if(v && !done){ done = true; resolve(v); }
    }).catch(() => {}).finally(() => {
      if(++settled === ps.length && !done){ done = true; resolve(null); }
    }));
  });
}

/* sweep: fire /stratus/games at EVERY mirror in parallel, first non-empty
   catalog wins, winner pinned as the stratus base */
function sweepStratusCatalog(){
  const attempts = FATE_STRATUS_MIRRORS.map(async (h) => {
    try{
      const data = await stratusFetch(h, 'games', 9000);
      const games = (data.games || []);
      return (!data.error && games.length) ? { host: h, games: games } : null;
    }catch(e){ return null; }
  });
  return _raceFirst(attempts);
}

function _mapCloudGames(raw){
  return (raw || []).map(g => ({
    id: 'stratus_' + g.key,
    name: g.name || 'Cloud Game',
    url: 'stratus://' + g.key,
    image: absolutizeStratus(g.cover || g.image || ''),
    top: false, new: false, exp: false, updated: false,
    cloud: true
  }));
}

/* catalog fetch with full fallback chain:
   fresh cache -> sweep (9 mirrors, parallel) -> saved catalog (any age).
   The grid must NEVER go blank: a failed sweep keeps whatever exists.
   (wrapped by fetchStratusGames at the original site below) */
async function _fetchStratusGamesV2(force){
  const cached = _lsGet(FATE_GAMES_KEY);
  if(!force && cached && Array.isArray(cached.games) && cached.games.length
     && Date.now() - cached.t < FATE_GAMES_TTL){
    console.log('[FATE PORTAL v2] fresh saved catalog (' + cached.games.length + ' games, host ' + cached.host + ')');
    window.FATE_LAST_SOURCE = 'cache';
    return _mapCloudGames(cached.games);
  }
  const winner = await sweepStratusCatalog();
  if(winner){
    setStratusBase(winner.host);
    _lsSet(FATE_GAMES_KEY, { t: Date.now(), host: winner.host, games: winner.games });
    console.log('[FATE PORTAL v2] sweep WINNER ' + winner.host + ' - ' + winner.games.length + ' games');
    window.FATE_LAST_SOURCE = 'live';
    return _mapCloudGames(winner.games);
  }
  if(cached && Array.isArray(cached.games) && cached.games.length){
    console.warn('[FATE PORTAL v2] sweep failed everywhere - showing saved catalog from ' + cached.host);
    window.FATE_LAST_SOURCE = 'cache';
    return _mapCloudGames(cached.games);
  }
  window.FATE_LAST_SOURCE = 'none';
  return [];
}

/* RELOAD GAMES button: drop old cloud entries, sweep every mirror fresh,
   merge whatever comes back, re-render. Honest status on the button. */
let _cloudReloading = false;
async function reloadCloudGames(){
  if(_cloudReloading) return;
  _cloudReloading = true;
  const btn = document.getElementById('cloudReloadBtn');
  const statusEl = document.getElementById('cloudReloadStatus');
  const oldHtml = btn ? btn.innerHTML : '';
  if(btn){ btn.classList.add('spinning'); btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> Loading…'; btn.disabled = true; btn.style.opacity = '.75'; }
  if(statusEl) statusEl.textContent = 'sweeping all 9 mirrors…';
  try{
    allGames = allGames.filter(g => !g.cloud);
    const games = await fetchStratusGames(true);
    if(games.length) allGames = allGames.concat(games);
    if(typeof applyFilters === 'function') applyFilters();
    if(statusEl){
      statusEl.textContent = games.length
        ? (window.FATE_LAST_SOURCE === 'live'
            ? (games.length + ' games loaded live')
            : (games.length + ' games (saved - backend down)'))
        : 'no mirror answered - nothing saved yet';
      setTimeout(() => { const el = document.getElementById('cloudReloadStatus'); if(el) el.textContent = ''; }, 8000);
    }
  }catch(e){
    console.warn('[FATE PORTAL v2] reload failed:', e && e.message);
    if(statusEl) statusEl.textContent = 'reload failed';
  }finally{
    _cloudReloading = false;
    if(btn){ btn.classList.remove('spinning'); btn.innerHTML = oldHtml; btn.disabled = false; btn.style.opacity = ''; }
  }
}

/* background auto-retry: no cloud games and nothing saved -> keep trying
   every 20 s so the section fills by itself when the backend comes back */
let _cloudRetries = 0;
function scheduleCloudRetry(){
  const haveCloud = allGames.some(g => g.cloud);
  const cached = _lsGet(FATE_GAMES_KEY);
  if(haveCloud || (cached && Array.isArray(cached.games) && cached.games.length)) return;
  if(_cloudRetries++ > 60) return;
  setTimeout(async () => {
    const games = await fetchStratusGames(true);
    if(games.length){
      allGames = allGames.concat(games);
      if(typeof applyFilters === 'function') applyFilters();
      console.log('[FATE PORTAL v2] auto-retry: ' + games.length + ' cloud games arrived');
    } else scheduleCloudRetry();
  }, 20000);
}
/* ===== END FATE PORTAL v2 CLOUD STACK ===== */

"""

REPLACEMENTS = [
    # 1. inject the v2 block before getBase()
    ("function getBase(){", V2_BLOCK.replace("BUILDSTAMP", BUILD) + "function getBase(){",
     "v2 cloud block injected"),

    # 2/3. getBase() defaults prefer the saved/picked mirror
    ("(window.serverList && window.serverList[0] || 'cdn.vipersfutbol.com')",
     "(window.serverList && window.serverList[0] || savedStratusMirror() || 'cdn.northstreetumc.org')",
     "getBase devMode default patched"),
    (": (window.wlspServer && window.wlspServer.includes('://') ? window.wlspServer.split('://')[1].split('/')[0] : 'cdn.vipersfutbol.com');",
     ": (savedStratusMirror() || (window.wlspServer && window.wlspServer.includes('://') ? window.wlspServer.split('://')[1].split('/')[0] : 'cdn.northstreetumc.org'));",
     "getBase wlsp default patched"),

    # 4. replace stratusApi with the retry-laddered version
    ("""async function stratusApi(path, method = 'GET', body){
  const base = `${getBase()}/stratus`;
  const res = await fetch(`${base}/${path}`, {
    method, credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok && !data.error) data.error = `HTTP ${res.status}`;
  return data;
}""",
     """/* stratusApi v2 — retry ladder lives inside (GET x3 / POST x2) */
async function stratusApi(path, method = 'GET', body){ return _stratusApiV2(path, method, body); }
async function _stratusApiV2(path, method = 'GET', body){
  const tries = method === 'GET' ? 3 : 2;
  let last = 'backend unreachable';
  for(let i = 0; i < tries; i++){
    try{
      const data = await stratusFetch(String(getBase()).replace(/^https?:\\/\\//, '').replace(/\\/+$/, ''), path, 9000);
      if(!data.error) return data;
      last = data.error;
      if(!FATE_TRANSIENT.test(last)) return data;
    }catch(e){
      last = (e && e.message) || 'network error';
      if(!FATE_TRANSIENT.test(last)) return { error: last };
    }
    if(i < tries - 1) await new Promise(r => setTimeout(r, i === 0 ? 700 : 2000));
  }
  return { error: last };
}""",
     "stratusApi → retry ladder"),

    # 5. replace fetchStratusGames with the sweep + cache version
    ("""async function fetchStratusGames(){
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(getBase() + '/stratus/games', { credentials: 'include', signal: ctrl.signal });
    clearTimeout(t);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return (data.games || []).map(g => ({
      id: 'stratus_' + g.key,
      name: g.name || 'Cloud Game',
      url: 'stratus://' + g.key,
      image: absolutizeStratus(g.cover || g.image || ''),
      top: false, new: false, exp: false, updated: false,
      cloud: true
    }));
  } catch(e) {
    console.warn('[FATE CDN] stratus failed:', e.message);
    return [];
  }
}""",
     """/* fetchStratusGames v2 — sweep + cache fallback (defined in the v2 block) */
async function fetchStratusGames(force){ return _fetchStratusGamesV2(force); }""",
     "fetchStratusGames → sweep + cache"),

    # 6. init(): cloud merge becomes non-blocking
    ("""  // Stratus cloud-streaming games (real cloud gaming)
  const cloudGames = await fetchStratusGames();
  if (cloudGames.length) {
    merged = merged.concat(cloudGames);
    console.log(`[FATE CDN] stratus: ${cloudGames.length} cloud games`);
  }""",
     """  // Stratus cloud-streaming games (real cloud gaming) — NON-BLOCKING:
  // the page renders the regular catalog immediately; cloud games merge in
  // the moment the mirror sweep answers (a dead CDN can no longer stall it)
  (async () => {
    const cloudGames = await fetchStratusGames(false);
    if (cloudGames.length) {
      allGames = allGames.concat(cloudGames.filter(g => !allGames.some(x => x.id === g.id)));
      console.log(`[FATE CDN] stratus: ${cloudGames.length} cloud games`);
      applyFilters();
    }
    scheduleCloudRetry();
  })();""",
     "init(): cloud merge non-blocking"),

    # 7. queue polling tolerates transient errors
    ("      while(_cloudSession && _cloudSession.uuid === sess.uuid){",
     "      let pollFails = 0;\n      while(_cloudSession && _cloudSession.uuid === sess.uuid){",
     "queue poll: fail counter added"),
    ("""        const poll = await stratusApi(`session/${_cloudSession.uuid}`);
        if(poll.error) throw new Error(poll.error);""",
     """        let poll = null;
        try{ poll = await stratusApi(`session/${_cloudSession.uuid}`); }catch(e){ poll = { error: (e && e.message) || 'poll failed' }; }
        if(poll.error){ if(++pollFails >= 5) throw new Error(poll.error); continue; }
        pollFails = 0;""",
     "queue poll: tolerates 5 consecutive transient errors"),

    # 8. reload button + status in the cloud section header
    ('      <span class="cloud-live"><span class="cloud-live-dot"></span>Cloud Streaming</span>',
     '      <span id="cloudReloadStatus" style="font-size:.72rem;font-weight:600;color:#fbbf24;white-space:nowrap;"></span>\n'
     '      <button id="cloudReloadBtn" onclick="reloadCloudGames()" title="Force-reload cloud games from all 9 CDN mirrors"\n'
     '        style="display:inline-flex;align-items:center;gap:.4rem;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.45);color:#fcd34d;font-size:.78rem;font-weight:600;padding:.4rem .85rem;border-radius:999px;cursor:pointer;transition:background .2s,transform .1s;"\n'
     '        onmouseover="this.style.background=\'rgba(245,158,11,.25)\'" onmouseout="this.style.background=\'rgba(245,158,11,.12)\'"\n'
     '        onmousedown="this.style.transform=\'scale(.96)\'" onmouseup="this.style.transform=\'\'">\n'
     '        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>\n'
     '        Reload games\n'
     '      </button>\n'
     '      <span class="cloud-live"><span class="cloud-live-dot"></span>Cloud Streaming</span>',
     "reload button added to cloud header"),

    # 9. empty state advertises the reload button
    ('      <p>Add games with <b style="color:#c4b5fd;">"cloud": true</b> in games.json to show them here</p>',
     '      <p>Hit <b style="color:#fbbf24;">Reload games</b> above — it sweeps all 9 CDN mirrors until one answers.\n'
     '      The backend flaps in and out; it usually comes back within minutes, and this page also retries\n'
     '      by itself every 20 s. Your last saved catalog shows here automatically.</p>',
     "empty state updated"),

    # 10. broken cover images hide gracefully (grid cards)
    ('<img data-src="${getGameImage(g)}" alt="${escapeHtml(g.name||\'Game\')}" class="game-img" loading="lazy" onload="this.classList.remove(\'loading\')" />',
     '<img data-src="${getGameImage(g)}" alt="${escapeHtml(g.name||\'Game\')}" class="game-img" loading="lazy" onload="this.classList.remove(\'loading\')" onerror="this.style.opacity=\'0\'" />',
     "grid card imgs hide on error"),

    # 11. broken cover images hide gracefully (recent row)
    ('<img src="${g.image}" alt="${escapeHtml(g.name)}" loading="lazy" />',
     '<img src="${g.image}" alt="${escapeHtml(g.name)}" loading="lazy" onerror="this.style.opacity=\'0\'" />',
     "recent row imgs hide on error"),

    # 12. footer build chip — lets the user VERIFY the new build deployed
    ('<p>FATE V5 — Made with <span style="color:#ef4444;">❤</span></p>',
     '<p>FATE V5 — Made with <span style="color:#ef4444;">❤</span> &nbsp;·&nbsp; <span style="color:#22d3ee;font-weight:600;">cloud build v2 — ' + BUILD + '</span></p>',
     "footer build chip added"),
]

# 13. spinner CSS for the reload button (before </head>)
STYLE_INJECT = (
    "  <style>\n"
    "    /* fate portal v2 — reload button spinner */\n"
    "    @keyframes fateCloudSpin { to { transform: rotate(360deg); } }\n"
    "    #cloudReloadBtn.spinning svg { animation: fateCloudSpin .9s linear infinite; }\n"
    "    #cloudReloadBtn:disabled { cursor: wait; }\n"
    "  </style>\n"
    "</head>"
)

with open(SRC, encoding="utf-8") as f:
    t = f.read()

for old, new, label in REPLACEMENTS:
    n = t.count(old)
    assert n == 1, f"anchor x{n} for: {label}"
    t = t.replace(old, new, 1)
    print("  ok:", label)

assert t.count("</head>") == 1, "</head> anchor"
t = t.replace("</head>", STYLE_INJECT, 1)
print("  ok: spinner CSS injected")

import os
os.makedirs(os.path.dirname(DST), exist_ok=True)
with open(DST, "w", encoding="utf-8") as f:
    f.write(t)

print(f"OK -> {DST}  ({len(t)} bytes, build {BUILD})")
