#!/usr/bin/env python3
"""Build download/test-v3-cloud-reload.html from download/fate-portal-v2.html.

v3 = v2 stack (sweep + retry + saved-catalog + reload button) PLUS the
"all 9 mirrors found nothing" survival kit:
  1. SELF-TEST panel: per-mirror probe table (direct vs via public proxy)
     with honest classification — OK / CF gate / HTTP X / timeout / blocked.
     Tells the user in 5 seconds whether it's their network or the origin.
  2. 27-lane sweep: 9 mirrors x (direct + codetabs + allorigins.win).
     Public proxies add vantage points (catch backend flap windows) and
     bypass school-network blocks on the cdn.* domains.
  3. Persistent auto-retry: ~5 h at 25 s (was 20 tries x 20 s), plus a
     "cloud games are back" ping when a retry lands after a dry spell.
  4. Build stamp: head comment, console marker, footer chip -> cloud build v3.
"""

SRC = "/home/z/my-project/download/fate-portal-v2.html"
DST = "/home/z/my-project/download/test-v3-cloud-reload.html"

BUILD = "2026-10-27"

REPLACEMENTS = [
    # 1. sweep -> 27-lane version (direct + 2 public proxy lanes per mirror)
    ("""/* sweep: fire /stratus/games at EVERY mirror in parallel, first non-empty
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
}""",
     """/* fetch through a named lane. via = null -> direct; 'codetabs' / 'allorigins'
   -> public CORS proxy (extra vantage points + bypasses local filters) */
async function stratusFetchVia(host, path, ms, via){
  const target = 'https://' + host + '/stratus/' + path;
  let url = target;
  if(via === 'codetabs') url = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(target);
  else if(via === 'allorigins') url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(target);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 9000);
  try{
    const res = await fetch(url, { credentials: 'omit', signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if(!res.ok && !data.error) data.error = 'HTTP ' + res.status;
    return data;
  }finally{ clearTimeout(t); }
}

/* sweep v3: fire /stratus/games at EVERY mirror on THREE lanes
   (direct + codetabs + allorigins) = 27 parallel attempts.
   First non-empty catalog wins, winner pinned as the stratus base.
   The proxy lanes catch backend flap windows the direct lane misses and
   still work when the local network blocks the cdn.* domains. */
function sweepStratusCatalog(){
  const lanes = [null, 'codetabs', 'allorigins'];
  const attempts = [];
  FATE_STRATUS_MIRRORS.forEach((h) => {
    lanes.forEach((via) => {
      attempts.push((async () => {
        try{
          const data = await stratusFetchVia(h, 'games', via ? 15000 : 9000, via);
          const games = (data.games || []);
          return (!data.error && games.length) ? { host: h, games: games, via: via } : null;
        }catch(e){ return null; }
      })());
    });
  });
  return _raceFirst(attempts);
}""",
     "sweep -> 27-lane (direct + 2 public proxies)"),

    # 2. auto-retry: 20 tries -> ~5 h persistence + "games are back" ping
    ("""let _cloudRetries = 0;
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
}""",
     """let _cloudRetries = 0;
function scheduleCloudRetry(){
  const haveCloud = allGames.some(g => g.cloud);
  const cached = _lsGet(FATE_GAMES_KEY);
  if(haveCloud || (cached && Array.isArray(cached.games) && cached.games.length)) return;
  if(_cloudRetries++ > 720) return;   /* ~5 h at 25 s */
  setTimeout(async () => {
    const games = await fetchStratusGames(true);
    if(games.length && window.FATE_LAST_SOURCE === 'live'){
      allGames = allGames.concat(games);
      if(typeof applyFilters === 'function') applyFilters();
      console.log('[FATE PORTAL v3] auto-retry: ' + games.length + ' cloud games arrived');
      const st = document.getElementById('cloudReloadStatus');
      if(st){ st.textContent = '\\u26a1 cloud games are back (' + games.length + ')'; }
      try{ if(navigator.vibrate) navigator.vibrate([80, 60, 80]); }catch(e){}
    } else scheduleCloudRetry();
  }, 25000);
}""",
     "auto-retry -> persistent (~5 h) + back-ping"),

    # 3. "Check mirrors" self-test button next to Reload games
    ('      <span class="cloud-live"><span class="cloud-live-dot"></span>Cloud Streaming</span>',
     '      <button id="cloudSelfTestBtn" onclick="runMirrorSelfTest()" title="Probe all 9 mirrors directly and through public proxies — shows exactly what is down"\n'
     '        style="display:inline-flex;align-items:center;gap:.4rem;background:rgba(34,211,238,.1);border:1px solid rgba(34,211,238,.4);color:#67e8f9;font-size:.78rem;font-weight:600;padding:.4rem .85rem;border-radius:999px;cursor:pointer;transition:background .2s,transform .1s;"\n'
     '        onmouseover="this.style.background=\'rgba(34,211,238,.22)\'" onmouseout="this.style.background=\'rgba(34,211,238,.1)\'"\n'
     '        onmousedown="this.style.transform=\'scale(.96)\'" onmouseup="this.style.transform=\'\'">\n'
     '        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>\n'
     '        Check mirrors\n'
     '      </button>\n'
     '      <span class="cloud-live"><span class="cloud-live-dot"></span>Cloud Streaming</span>',
     "self-test button added to cloud header"),

    # 4. self-test results panel markup (right after the cloud header block)
    ('    <p class="cloud-sub">Streamed live from the <b>cloud</b> — no downloads, no installs. Click any card and a session boots instantly.</p>',
     '    <p class="cloud-sub">Streamed live from the <b>cloud</b> — no downloads, no installs. Click any card and a session boots instantly.</p>\n'
     '    <div id="selfTestPanel" style="display:none;margin:.9rem 0 .4rem;background:rgba(0,0,0,.35);border:1px solid rgba(148,163,184,.25);border-radius:14px;padding:.9rem 1rem;overflow-x:auto;">\n'
     '      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;gap:.75rem;flex-wrap:wrap;">\n'
     '        <b style="font-size:.85rem;color:#e2e8f0;">Mirror self-test <span id="selfTestPhase" style="color:#94a3b8;font-weight:500;"></span></b>\n'
     '        <span style="font-size:.7rem;color:#94a3b8;">green = backend answered · amber = Cloudflare bot-gate · red = blocked from your network · grey = origin silent</span>\n'
     '      </div>\n'
     '      <table style="width:100%;border-collapse:collapse;font-size:.75rem;color:#cbd5e1;min-width:520px;">\n'
     '        <thead><tr style="color:#94a3b8;text-align:left;">\n'
     '          <th style="padding:.3rem .5rem;font-weight:600;">Mirror</th>\n'
     '          <th style="padding:.3rem .5rem;font-weight:600;">Direct</th>\n'
     '          <th style="padding:.3rem .5rem;font-weight:600;">Via codetabs</th>\n'
     '          <th style="padding:.3rem .5rem;font-weight:600;">Via allorigins</th>\n'
     '        </tr></thead>\n'
     '        <tbody id="selfTestRows"></tbody>\n'
     '      </table>\n'
     '      <div id="selfTestVerdict" style="margin-top:.7rem;font-size:.78rem;line-height:1.5;color:#e2e8f0;"></div>\n'
     '    </div>',
     "self-test panel markup added"),

    # 5. self-test engine JS (after the scheduleCloudRetry function's end)
    ("/* ===== END FATE PORTAL v2 CLOUD STACK ===== */",
     """/* ===== FATE PORTAL v3 SELF-TEST ===== */
console.log('[FATE PORTAL v3] cloud stack build @BUILD@ - 27-lane sweep + mirror self-test + persistent retry');
let _selfTestRunning = false;
function _stCell(label, ms, cls){
  const color = cls === 'ok' ? '#4ade80' : cls === 'gate' ? '#fbbf24'
              : cls === 'blocked' ? '#f87171' : '#94a3b8';
  return '<span style="color:' + color + ';font-weight:600;">' + label + '</span>'
       + (ms != null ? ' <span style="color:#64748b;">(' + ms + ' ms)</span>' : '');
}
async function _stProbe(host, via, ms){
  const t0 = performance.now();
  try{
    const data = await stratusFetchVia(host, 'status', ms, via);
    const ms2 = Math.round(performance.now() - t0);
    if(data && !data.error) return _stCell('backend UP', ms2, 'ok');
    const err = (data && data.error) || 'error';
    if(/HTTP 403/.test(err)) return _stCell('CF bot-gate', ms2, 'gate');
    if(/HTTP 5\d\d/.test(err)) return _stCell(err.replace('HTTP ', 'origin dead (HTTP ') + ')', ms2, 'down');
    return _stCell(err, ms2, 'blocked');
  }catch(e){
    const ms2 = Math.round(performance.now() - t0);
    const msg = String((e && e.message) || e);
    if(/abort/i.test(msg)) return _stCell('timeout', null, 'down');
    return _stCell('blocked / bot-checked', null, 'blocked');
  }
}
async function runMirrorSelfTest(){
  if(_selfTestRunning) return;
  _selfTestRunning = true;
  const panel = document.getElementById('selfTestPanel');
  const rows = document.getElementById('selfTestRows');
  const phase = document.getElementById('selfTestPhase');
  const verdict = document.getElementById('selfTestVerdict');
  const btn = document.getElementById('cloudSelfTestBtn');
  if(btn){ btn.disabled = true; btn.style.opacity = '.7'; }
  panel.style.display = 'block';
  rows.innerHTML = '';
  verdict.textContent = '';
  phase.textContent = '· probing 9 mirrors on 2 lanes…';
  const results = [];
  for(const h of FATE_STRATUS_MIRRORS){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td style="padding:.3rem .5rem;border-top:1px solid rgba(148,163,184,.12);font-family:monospace;">' + h + '</td>'
                 + '<td style="padding:.3rem .5rem;border-top:1px solid rgba(148,163,184,.12);color:#64748b;">…</td>'
                 + '<td style="padding:.3rem .5rem;border-top:1px solid rgba(148,163,184,.12);color:#64748b;">…</td>'
                 + '<td style="padding:.3rem .5rem;border-top:1px solid rgba(148,163,184,.12);color:#64748b;">…</td>';
    rows.appendChild(tr);
    const cells = tr.getElementsByTagName('td');
    /* direct + both public proxies in parallel; status endpoint is cheap */
    const p1 = _stProbe(h, null, 7000).then(r => { cells[1].innerHTML = r; return r; }).catch(() => '');
    const p2 = _stProbe(h, 'codetabs', 16000).then(r => { cells[2].innerHTML = r; return r; }).catch(() => '');
    const p3 = _stProbe(h, 'allorigins', 12000).then(r => { cells[3].innerHTML = r; return r; }).catch(() => '');
    results.push(Promise.all([p1, p2, p3]).then(arr => ({ host: h, arr })));
  }
  const done = await Promise.all(results);
  phase.textContent = '· done';
  const directUp = done.filter(r => /backend UP/.test(r.arr[0])).length;
  const proxyUp = done.filter(r => /backend UP/.test(r.arr[1]) || /backend UP/.test(r.arr[2])).length;
  const gated = done.filter(r => /CF bot-gate/.test(r.arr[0])).length;
  const blocked = done.filter(r => /blocked/.test(r.arr[0])).length;
  let v = '';
  if(directUp) v += '\\u2705 <b>' + directUp + '/9 mirrors answered directly</b> — your network reaches the CDN fine. ';
  if(gated) v += '\\u26a0 ' + gated + ' mirror(s) show a Cloudflare bot-check from here; real browsers usually pass. ';
  if(blocked) v += '\\u26D4 ' + blocked + ' mirror(s) are <b>blocked from your network</b> (school filter / DNS). ';
  v += proxyUp ? 'The public-proxy lanes see the backend, so the catalog sweep will get through on those.'
               : 'Nobody can reach the backend right now — even public proxies time out. That means the Stratus origin itself is down (it flaps in and out — the page keeps retrying every 25 s and games pop in by themselves when it returns).';
  verdict.innerHTML = v;
  console.log('[FATE PORTAL v3] self-test: direct UP ' + directUp + '/9, proxy-lane UP ' + proxyUp + '/9, gated ' + gated + ', blocked ' + blocked);
  _selfTestRunning = false;
  if(btn){ btn.disabled = false; btn.style.opacity = ''; }
}
/* ===== END FATE PORTAL v3 SELF-TEST ===== */
/* ===== END FATE PORTAL v2 CLOUD STACK ===== */""",
     "self-test engine injected"),

    # 6. empty-state copy mentions the self-test
    ('      <p>Hit <b style="color:#fbbf24;">Reload games</b> above — it sweeps all 9 CDN mirrors until one answers.',
     '      <p>Hit <b style="color:#fbbf24;">Reload games</b> above — it now sweeps 27 lanes (9 mirrors × direct + 2 public proxies).\n'
     '      Use <b style="color:#67e8f9;">Check mirrors</b> to see exactly which mirrors are up, gated, or blocked from your network.',
     "empty state updated for v3"),

    # 7. footer chip -> v3
    ('cloud build v2 — 2026-10-27',
     'cloud build v3 — ' + BUILD + ' (27-lane sweep + self-test)',
     "footer chip -> v3"),

    # 8. head build comment (verifiable in view-source)
    ("</head>",
     "<!-- FATE PORTAL BUILD v3 (" + BUILD + ") : 27-lane sweep + mirror self-test + persistent retry -->\n</head>",
     "head build comment added"),
]

# spinner/btn CSS (before the existing style block close)
STYLE_INJECT = (
    "    /* fate portal v3 — self-test button */\n"
    "    #cloudSelfTestBtn:disabled { cursor: wait; }\n"
    "    #selfTestPanel table td, #selfTestPanel table th { white-space: nowrap; }\n"
)

with open(SRC, encoding="utf-8") as f:
    t = f.read()

for old, new, label in REPLACEMENTS:
    n = t.count(old)
    assert n == 1, f"anchor x{n} for: {label}"
    t = t.replace(old, new, 1)
    print("  ok:", label)

# append CSS to the v2 style block (anchor: the spinner CSS comment)
css_anchor = "    /* fate portal v2 — reload button spinner */"
assert t.count(css_anchor) == 1
t = t.replace(css_anchor, STYLE_INJECT + css_anchor, 1)
print("  ok: v3 CSS injected")

import os
os.makedirs(os.path.dirname(DST), exist_ok=True)
t = t.replace("@BUILD@", BUILD)
with open(DST, "w", encoding="utf-8") as f:
    f.write(t)

print(f"OK -> {DST}  ({len(t)} bytes, build {BUILD})")
