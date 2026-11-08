#!/usr/bin/env python3
"""FATE Movies v2.4 builder — LIVE TMDB catalog (the milkbox method).

Upgrades download/site/movies.html v2.3 -> v2.4 in place:
  * TMDB data layer = the exact method milky.japan.is ships in its own
    app.js: a public v4 READ token + api.themoviedb.org/3 calls.
  * Lane 1 DIRECT: browser fetch (TMDB answers CORS:* — works on open
    networks). Lane 2 WISP: the same request as a raw HTTP/1.1 GET to
    api.themoviedb.org:80 through the FATE wisp tunnel (token header
    intact), hopping the engine lanes with a sticky winner.
  * 6h localStorage JSON cache; stale cache survives total outage.
  * Posters image.tmdb.org direct -> wsrv.nl mirror on error.
  * Browse: Trending / Top Rated / Newest + TMDB genre discover with
    infinite scroll (Movies & TV), live multi-search, detail sheet with
    cast + certification + recommendations + TV season/episode browser
    that plays into the existing VidZee (peak) / MILKBOX server ring.
  * The 1247-title on-device catalog stays as the "Vault" pill.
Idempotent: exits cleanly if v2.4 is already applied.
"""
import pathlib, sys

F = pathlib.Path('/home/z/my-project/download/site/movies.html')
html = F.read_text(encoding='utf-8')

if 'FATE MOVIES 2.4' in html:
    print('already v2.4 — nothing to do')
    sys.exit(0)

def rep(old, new, count=1):
    global html
    n = html.count(old)
    if n != count:
        sys.exit('ANCHOR FAIL (%dx, want %d): %r' % (n, count, old[:100]))
    html = html.replace(old, new)

# ------------------------------------------------------------------ 1. banner
rep('   FATE MOVIES 2.3 \u2014 VidZee (peak) primary + MILKBOX + wisp site vault',
    r'''   FATE MOVIES 2.4 — LIVE TMDB catalog via the milkbox.japan.is method
   (public v4 read token + api.themoviedb.org/3), wisp-tunnel lane for
   blocked networks, wsrv.nl poster mirror. Vault = offline mode.''')

# ------------------------------------------------------------------ 2. subtitle
rep('<p>Search anything. Watch anything. Movies &amp; shows on demand.</p>',
    '<p>Search anything. Watch anything — every movie &amp; show, live from TMDB.</p>')

# ------------------------------------------------------------------ 3. vault pill
rep('''    <button class="pill" data-cat="year" onclick="setCat('year',this)">Newest</button>
  </div>''',
    '''    <button class="pill" data-cat="year" onclick="setCat('year',this)">Newest</button>
    <button class="pill" data-cat="vault" onclick="setCat('vault',this)" title="the on-device catalog, works fully offline">📀 Vault</button>
  </div>''')

# ------------------------------------------------------------------ 4. live CSS
rep('@media(max-width:760px){.sgrid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.sites-wrap{padding:2px 14px 20px}}\n</style>',
    r'''/* ===== live TMDB ===== */
.mcard .poster .timg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.02);transition:transform .45s ease}
.mcard:hover .poster .timg{transform:scale(1.09)}
.d-poster .timg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px}
.hc-poster .timg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sim-title{margin-top:20px;font-size:.74rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)}
.sim-row{display:flex;gap:10px;overflow-x:auto;padding:12px 2px 6px;scrollbar-width:thin}
.sim-card{flex:0 0 92px;cursor:pointer;text-align:center;border:none;background:none;padding:0;font-family:inherit}
.sim-card .sp{width:92px;height:138px;border-radius:10px;object-fit:cover;border:1px solid var(--glass-border);background:#0d0d0d;display:block}
.sim-card .sn{font-size:.68rem;color:var(--text-muted);margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:92px}
.sim-card:hover .sp{border-color:rgba(var(--primary-rgb),0.55)}
.ep-tools{display:flex;gap:8px;align-items:center;margin-top:18px;flex-wrap:wrap}
.ep-tools label{font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em}
.ep-tools select{padding:9px 12px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text);font-family:inherit;font-size:.85rem;cursor:pointer;outline:none}
.ep-list{margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:330px;overflow-y:auto;padding-right:4px}
.ep-item{display:flex;gap:12px;align-items:center;padding:9px 12px;border:1px solid var(--glass-border);border-radius:12px;background:rgba(255,255,255,0.03);cursor:pointer;transition:border-color .2s,background .2s;text-align:left;width:100%;font-family:inherit}
.ep-item:hover{border-color:rgba(var(--primary-rgb),0.5);background:rgba(var(--primary-rgb),0.07)}
.ep-num{flex:0 0 auto;font-family:"Space Grotesk",sans-serif;font-weight:800;color:var(--primary-soft);width:34px;text-align:center}
.ep-body{min-width:0;flex:1}
.ep-name{font-size:.84rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ep-sub{font-size:.7rem;color:var(--text-muted)}
.ep-play{flex:0 0 auto;width:30px;height:30px;border-radius:9px;border:1px solid rgba(var(--primary-rgb),0.4);background:rgba(var(--primary-rgb),0.1);display:flex;align-items:center;justify-content:center}
.ep-play svg{width:13px;height:13px;fill:var(--primary-soft)}
.net-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:20px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.04);font-size:.72rem;font-weight:700;color:var(--text-muted);cursor:pointer;transition:all .2s;font-family:inherit}
.net-chip:hover{border-color:rgba(var(--primary-rgb),0.45);color:var(--primary-soft)}
.net-chip .nd{width:8px;height:8px;border-radius:50%;background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,0.8)}
.net-chip.ok .nd{background:#10b981;box-shadow:0 0 8px #10b981}
.net-chip.bad .nd{background:#ef4444;box-shadow:none}
.net-chip.wait .nd{animation:pulse 1s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
@media(max-width:760px){.sgrid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.sites-wrap{padding:2px 14px 20px}}
</style>''')

# ------------------------------------------------------------------ 5. net chip in header
rep('<div class="source-chip" id="sourceChip"><span class="dot"></span><span id="sourceLabel">Catalog: connecting…</span></div>',
    '''<div class="source-chip" id="sourceChip"><span class="dot"></span><span id="sourceLabel">Catalog: connecting…</span></div>
    <div style="margin-top:10px"><button class="net-chip wait" id="netChip" onclick="tmdbLaneCycle()" title="TMDB data lane — click to toggle direct / wisp tunnel"><span class="nd"></span><span id="netLabel">TMDB: connecting…</span></button></div>''')

# ------------------------------------------------------------------ 6. liveExtras in detail sheet
rep('''      <p class="d-cast" id="dCast"></p>
      <div class="play-row">''',
    '''      <p class="d-cast" id="dCast"></p>
      <div id="liveExtras"></div>
      <div class="play-row">''')

# ------------------------------------------------------------------ 7. TMDB module (before SITES VAULT)
rep('''/* ================================================================
   SITES VAULT — confirmed sources + wisp-tested sites + lane prober
   ================================================================ */''',
    r'''/* ================================================================
   LIVE TMDB — every movie & show, fetched the milkbox.japan.is way.
   MILKBOX ships a public TMDB v4 READ token in its own app.js and
   calls api.themoviedb.org/3 with it — we reuse that exact token.
   Lane 1 DIRECT fetch (TMDB answers Access-Control-Allow-Origin:*).
   Lane 2 WISP TUNNEL: raw HTTP/1.1 GET to api.themoviedb.org:80 over
   the FATE wisp endpoints (TMDB still serves plain HTTP on port 80),
   token header intact, sticky lane remembered. 6h JSON cache keeps
   browsing alive when every lane dies. Posters fall back to wsrv.nl.
   ================================================================ */
var TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkODIxZmZjZjFhMjQxOWFhMWZjZjY5MjMwMDZjZmNjNCIsIm5iZiI6MTc3NzU2MDc0My45NzMsInN1YiI6IjY5ZjM2Y2E3ZDZhZjA3Yjg2Zjg0MzA3MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ._CFnVPW7SyxmHdzu3Uxee0LkMlGm4zdW2uCNFV2g9A8';
var TMDB_HOST = 'api.themoviedb.org';
var LS_TM = { CACHE: 'fate_tmdb_cache_v1', LANE: 'fate_tmdb_lane', PREF: 'fate_tmdb_pref' };
/* baked TMDB genre lists (refreshed from the API when a lane is up) */
var GM_GEN = [{id:28,n:'Action'},{id:12,n:'Adventure'},{id:16,n:'Animation'},{id:35,n:'Comedy'},{id:80,n:'Crime'},{id:99,n:'Documentary'},{id:18,n:'Drama'},{id:10751,n:'Family'},{id:14,n:'Fantasy'},{id:36,n:'History'},{id:27,n:'Horror'},{id:10402,n:'Music'},{id:9648,n:'Mystery'},{id:10749,n:'Romance'},{id:878,n:'Science Fiction'},{id:53,n:'Thriller'},{id:10752,n:'War'},{id:37,n:'Western'}];
var GTV_GEN = [{id:10759,n:'Action & Adventure'},{id:16,n:'Animation'},{id:35,n:'Comedy'},{id:80,n:'Crime'},{id:99,n:'Documentary'},{id:18,n:'Drama'},{id:10751,n:'Family'},{id:10762,n:'Kids'},{id:9648,n:'Mystery'},{id:10763,n:'News'},{id:10764,n:'Reality'},{id:10765,n:'Sci-Fi & Fantasy'},{id:10766,n:'Soap'},{id:10767,n:'Talk'},{id:10768,n:'War & Politics'}];
var LIVE = {};                 /* 'm:550' -> meta (this session) */
var liveOK = false, liveMode = true, liveLane = 'direct';
var tmPage = 1, tmDone = false, tmFetching = false, tmQuery = '';
var dSeq = 0;

function tmdbImg(path, size){
  if (!path) return '';
  return 'https://image.tmdb.org/t/p/' + (size || 'w342') + path;
}
function tmdbImgErr(im){
  if (!im.getAttribute('data-fb')){
    im.setAttribute('data-fb', '1');
    im.src = 'https://wsrv.nl/?url=' + encodeURIComponent(String(im.getAttribute('src')).replace(/^https?:\/\//, '')) + '&w=342&output=jpg&q=80';
  } else {
    im.style.display = 'none';
  }
}
/* ---- cache ---- */
function tmdbCacheGet(key, anyAge){
  try {
    var c = JSON.parse(localStorage.getItem(LS_TM.CACHE) || '{}');
    var e = c[key];
    if (e && (anyAge || (Date.now() - e.t) < 21600000)) return e.d;
  } catch(err){}
  return null;
}
function tmdbCachePut(key, d){
  try {
    var c = JSON.parse(localStorage.getItem(LS_TM.CACHE) || '{}');
    var ks = Object.keys(c);
    if (ks.length > 240) ks.slice(0, 60).forEach(function(x){ delete c[x]; });
    c[key] = { t: Date.now(), d: d };
    localStorage.setItem(LS_TM.CACHE, JSON.stringify(c));
  } catch(err){}
}
function tmdbCacheClear(){
  try { localStorage.removeItem(LS_TM.CACHE); } catch(e){}
  toast('TMDB cache cleared');
}
/* ---- lane status chip ---- */
function setNet(state, text){
  var c = $('netChip');
  if (!c) return;
  c.classList.remove('ok', 'bad', 'wait');
  c.classList.add(state);
  $('netLabel').textContent = text;
}
/* ---- raw HTTP/1.1 GET over the wisp tunnel ---- */
function wHttpBody(chunks){
  var total = 0, i;
  for (i = 0; i < chunks.length; i++) total += chunks[i].length;
  if (!total) return null;
  var all = new Uint8Array(total), p = 0;
  for (i = 0; i < chunks.length; i++){ all.set(chunks[i], p); p += chunks[i].length; }
  var raw = new TextDecoder('latin1').decode(all);
  var sp = raw.indexOf('\r\n\r\n');
  if (sp < 0) return null;
  var head = raw.slice(0, sp);
  var m = head.match(/HTTP\/1\.[01] (\d+)/);
  var code = m ? parseInt(m[1], 10) : 0;
  var hl = head.toLowerCase();
  var bodyBytes = all.subarray(sp + 4);
  var text;
  if (hl.indexOf('transfer-encoding: chunked') > -1){
    text = wDechunk(bodyBytes);
  } else {
    var cm = head.match(/Content-Length: (\d+)/i);
    text = new TextDecoder().decode(cm ? bodyBytes.subarray(0, parseInt(cm[1], 10)) : bodyBytes);
  }
  return { code: code, text: text };
}
function wDechunk(b){
  var out = [], i = 0, dec = new TextDecoder('latin1');
  while (i < b.length){
    var j = i;
    while (j < b.length && !(b[j] === 13 && b[j + 1] === 10)) j++;
    var n = parseInt(dec.decode(b.subarray(i, j)).split(';')[0].trim(), 16);
    if (isNaN(n) || n === 0) break;
    out.push(b.subarray(j + 2, Math.min(j + 2 + n, b.length)));
    i = j + 2 + n + 2;
  }
  var total = 0; out.forEach(function(u){ total += u.length; });
  var o = new Uint8Array(total), p = 0;
  out.forEach(function(u){ o.set(u, p); p += u.length; });
  return new TextDecoder().decode(o);
}
function wispHttpGet(ep, path, cb){   /* cb(ok, json, laneName) */
  var fin = false, conn = null, chunks = [], size = 0;
  var req = 'GET /3' + path + ' HTTP/1.1\r\nHost: ' + TMDB_HOST + '\r\naccept: application/json\r\nAuthorization: Bearer ' + TMDB_TOKEN + '\r\nUser-Agent: Mozilla/5.0 (FATE)\r\nConnection: close\r\n\r\n';
  function done(ok, json, why){
    if (fin) return; fin = true;
    clearTimeout(to);
    try { if (conn && conn.ws) conn.ws.close(); } catch(e){}
    cb(ok, json, why);
  }
  var to = setTimeout(function(){ done(false, null, 'timeout'); }, 12000);
  try { conn = new WConn(ep); } catch(e){ clearTimeout(to); return done(false, null, 'ctor'); }
  conn.addEventListener('open', function(){
    var s;
    try { s = conn.create_stream(TMDB_HOST, 80); } catch(e){ return done(false, null, 'stream'); }
    s.addEventListener('message', function(ev){
      var u = new Uint8Array(ev.data);
      chunks.push(u); size += u.length;
      if (size > 3000000) done(false, null, 'too big');
    });
    s.addEventListener('close', function(){
      var b = wHttpBody(chunks);
      if (!b) return done(false, null, 'bad http');
      if (b.code !== 200) return done(false, null, 'HTTP ' + b.code);
      try { done(true, JSON.parse(b.text), ep); } catch(e){ done(false, null, 'json'); }
    });
    try { s.send(new TextEncoder().encode(req)); } catch(e){ done(false, null, 'send'); }
  });
  conn.addEventListener('error', function(){ done(false, null, 'ws error'); });
}
function laneOrder(){
  var sticky = null;
  try { sticky = localStorage.getItem(LS_TM.LANE); } catch(e){}
  var rest = LANES.map(function(l){ return l[1]; }).filter(function(u){ return u !== sticky; });
  if (sticky) rest.unshift(sticky);
  return rest;
}
function laneName(ep){
  for (var i = 0; i < LANES.length; i++) if (LANES[i][1] === ep) return LANES[i][0];
  return 'wisp';
}
/* ---- main fetch: cache -> lane -> stale ---- */
function tmdb(path){
  var sep = path.indexOf('?') > -1 ? '&' : '?';
  var full = path + sep + 'language=en-US';
  var fresh = tmdbCacheGet(path, false);
  if (fresh) return Promise.resolve(fresh);
  if (liveLane === 'wisp') return tmdbWisp(full, path);
  return tmdbDirect(full, path);
}
function tmdbDirect(full, key){
  setNet('wait', 'TMDB: direct lane…');
  var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var to = ac ? setTimeout(function(){ try { ac.abort(); } catch(e){} }, 8000) : null;
  return fetch('https://' + TMDB_HOST + '/3' + full, {
    headers: { accept: 'application/json', Authorization: 'Bearer ' + TMDB_TOKEN },
    signal: ac ? ac.signal : undefined
  }).then(function(r){
    if (to) clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(d){
    tmdbCachePut(key, d);
    liveLane = 'direct';
    setNet('ok', 'TMDB live · direct');
    return d;
  }).catch(function(e){
    if (to) clearTimeout(to);
    var stale = tmdbCacheGet(key, true);
    if (stale){ setNet('bad', 'TMDB: cached copy'); return stale; }
    return tmdbWisp(full, key, String(e && e.message || e));
  });
}
function tmdbWisp(full, key, why){
  setNet('wait', 'TMDB: wisp tunnel…');
  return new Promise(function(resolve){
    var order = laneOrder(), i = 0;
    function next(){
      if (i >= order.length){
        setNet('bad', 'TMDB unreachable' + (why ? ' · ' + why : ''));
        resolve(tmdbCacheGet(key, true));
        return;
      }
      var ep = order[i++];
      wispHttpGet(ep, full, function(ok, d){
        if (ok){
          tmdbCachePut(key, d);
          liveLane = 'wisp';
          try { localStorage.setItem(LS_TM.LANE, ep); localStorage.setItem(LS_TM.PREF, 'wisp'); } catch(e){}
          setNet('ok', 'TMDB live · wisp (' + laneName(ep) + ')');
          resolve(d);
        } else next();
      });
    }
    next();
  });
}
function tmdbLaneCycle(){
  liveLane = (liveLane === 'direct') ? 'wisp' : 'direct';
  try { localStorage.setItem(LS_TM.PREF, liveLane); } catch(e){}
  toast('TMDB lane: ' + (liveLane === 'direct' ? 'direct' : 'wisp tunnel'));
  if (liveOK) backToBrowse();
}
/* ---- list mapping ---- */
function tmToMeta(r){
  var isS = r.media_type ? r.media_type === 'tv' : (!r.title && !!r.name);
  var n = r.title || r.name || '';
  var y = parseInt(String(r.release_date || r.first_air_date || '').slice(0, 4), 10) || null;
  var key = (isS ? 's:' : 'm:') + r.id;
  return { i: key, lk: key, tm: r.id, t: isS ? 's' : 'm', n: n, y: y,
           r: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
           p: r.poster_path || null, bp: r.backdrop_path || null, d: r.overview || '' };
}
function tmCatPath(){
  var list = (kind === 'movie') ? GM_GEN : GTV_GEN;
  var gid = null;
  for (var i = 0; i < list.length; i++) if (list[i].n === genre) gid = list[i].id;
  var withG = gid ? '&with_genres=' + gid : '';
  var today = new Date().toISOString().slice(0, 10);
  if (kind === 'movie'){
    if (cat === 'imdbRating') return '/discover/movie?sort_by=vote_average.desc&vote_count.gte=1500' + withG;
    if (cat === 'year') return '/discover/movie?sort_by=primary_release_date.desc&vote_count.gte=80&primary_release_date.lte=' + today + withG;
    if (gid) return '/discover/movie?sort_by=popularity.desc' + withG;
    return '/trending/movie/day';
  }
  if (cat === 'imdbRating') return '/discover/tv?sort_by=vote_average.desc&vote_count.gte=300' + withG;
  if (cat === 'year') return '/discover/tv?sort_by=first_air_date.desc&vote_count.gte=40&first_air_date.lte=' + today + withG;
  if (gid) return '/discover/tv?sort_by=popularity.desc' + withG;
  return '/trending/tv/day';
}
/* ---- live grid paging ---- */
function liveLoadPage(){
  if (tmFetching || tmDone) return;
  tmFetching = true;
  var base;
  if (mode === 'tmsearch'){
    if (!tmQuery){ tmFetching = false; return; }
    base = '/search/multi?query=' + encodeURIComponent(tmQuery) + '&include_adult=false';
  } else {
    base = tmCatPath();
  }
  var path = base + (base.indexOf('?') > -1 ? '&' : '?') + 'page=' + tmPage;
  if (!$('grid').children.length) setState('<div class="big">🛰</div>Fetching from TMDB…');
  tmdb(path).then(function(d){
    tmFetching = false;
    if (mode !== 'tmcat' && mode !== 'tmsearch') return;
    if (!d || !d.results){ tmDone = true; liveEmpty(); return; }
    var items = d.results.filter(function(r){
      var mt = r.media_type || (r.title ? 'movie' : 'tv');
      return mt !== 'person';
    }).map(tmToMeta).filter(function(m){ return m.n; });
    items.forEach(function(m){ LIVE[m.lk] = m; });
    if (tmPage >= (d.total_pages || 1) || tmPage >= 25) tmDone = true;
    tmPage++;
    setState('');
    $('grid').insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
    if (!$('grid').children.length) liveEmpty();
    if (mode === 'tmsearch' && tmDone) localSearchAppend(tmQuery);
  }).catch(function(){
    tmFetching = false; tmDone = true;
    if (mode === 'tmsearch') localSearchAppend(tmQuery);
    else liveEmpty(true);
  });
}
function liveEmpty(fail){
  if ($('grid').children.length){ setState(''); return; }
  setState('<div class="big">🍿</div>' + (fail ? 'The TMDB lane is down and nothing is cached for this view.' : 'Nothing here — try another category or search.') +
    '<br><span style="font-size:.8rem">The 📀 Vault pill always holds the 1247-title offline catalog.</span>');
}
function localMatches(q){
  var ql = q.toLowerCase(), res = [], pool = MOV.concat(SER);
  for (var i = 0; i < pool.length; i++){
    var nm = (pool[i].n || '').toLowerCase();
    if (nm.indexOf(ql) > -1) res.push(pool[i]);
  }
  res.sort(function(a, b){
    var sa = a.n.toLowerCase().indexOf(ql) === 0 ? 1 : 0;
    var sb = b.n.toLowerCase().indexOf(ql) === 0 ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.r || 0) - (a.r || 0);
  });
  return res;
}
function localSearchAppend(q){
  var lm = localMatches(q).slice(0, 40);
  if (!lm.length){
    if (!$('grid').children.length){
      setState('<div class="big">🍿</div>Nothing found for \u201C' + esc(q) + '\u201D<br><span style="font-size:.8rem">TMDB came up empty and the vault has no match either.</span>');
    }
    return;
  }
  lm.forEach(function(m){ BYID[m.i] = m; });
  $('grid').insertAdjacentHTML('beforeend', lm.map(cardHTML).join(''));
  var nodes = $('grid').querySelectorAll('.mcard');
  var base = nodes.length - lm.length;
  for (var i = 0; i < lm.length; i++){
    var card = nodes[base + i];
    if (!card) continue;
    var mp = card.querySelector('.mp');
    if (mp) paintSprite(mp, lm[i].x);
  }
}
/* ---- live detail ---- */
function openLive(key){
  var m = LIVE[key];
  if (!m) return;
  currentMeta = m;
  var my = ++dSeq;
  $('detailOverlay').classList.add('open');
  $('liveExtras').innerHTML = '';
  $('dName').textContent = m.n;
  var chips = '';
  if (m.y) chips += '<span class="d-chip">' + m.y + '</span>';
  if (m.r) chips += '<span class="d-chip gold"><svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' + m.r + '</span>';
  chips += '<span class="d-chip">' + (m.t === 's' ? 'Series' : 'Movie') + '</span>';
  $('dMeta').innerHTML = chips;
  $('dDesc').textContent = m.d || 'No description on file — hit play anyway, the stream does not need it.';
  $('dCast').innerHTML = '';
  $('dPlayLabel').textContent = 'Play now';
  var poster = $('dPoster');
  poster.classList.remove('noimg');
  poster.innerHTML = m.p ? '<img class="timg" alt="" src="' + tmdbImg(m.p, 'w342') + '" onerror="tmdbImgErr(this)"/>' : '';
  if (!m.p) poster.classList.add('noimg');
  var bg = $('dBg');
  if (m.bp){
    bg.style.backgroundImage = 'url("' + tmdbImg(m.bp, 'w780') + '")';
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center 20%';
  } else {
    bg.style.backgroundImage = 'none';
  }
  var t = m.t === 's' ? 'tv' : 'movie';
  tmdb('/' + t + '/' + m.tm + '?append_to_response=credits,release_dates,content_ratings').then(function(d){
    if (my !== dSeq || !d) return;
    liveDetailFill(m, d);
  }).catch(function(){});
  tmdb('/' + t + '/' + m.tm + '/recommendations').then(function(d){
    if (my !== dSeq || !d) return;
    liveSimRow(d);
  }).catch(function(){});
}
function liveDetailFill(m, d){
  var chips = '';
  var y = parseInt(String(d.release_date || d.first_air_date || '').slice(0, 4), 10) || m.y;
  if (y) chips += '<span class="d-chip">' + y + '</span>';
  if (d.vote_average) chips += '<span class="d-chip gold"><svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' + (Math.round(d.vote_average * 10) / 10) + '</span>';
  chips += '<span class="d-chip">' + (m.t === 's' ? 'Series' : 'Movie') + '</span>';
  var cert = liveCert(d, m.t);
  if (cert) chips += '<span class="d-chip">' + esc(cert) + '</span>';
  if (m.t === 's' && d.number_of_seasons) chips += '<span class="d-chip">' + d.number_of_seasons + ' season' + (d.number_of_seasons > 1 ? 's' : '') + '</span>';
  if (d.runtime) chips += '<span class="d-chip">' + d.runtime + ' min</span>';
  (d.genres || []).forEach(function(g){ chips += '<span class="d-chip">' + esc(g.name) + '</span>'; });
  $('dMeta').innerHTML = chips;
  if (d.overview) $('dDesc').textContent = d.overview;
  var cast = (d.credits && d.credits.cast || []).slice(0, 6).map(function(c){ return c.name; });
  if (cast.length) $('dCast').innerHTML = '<b>Cast:</b> ' + esc(cast.join(', '));
  if (m.t === 's'){
    var seasons = (d.seasons || []).filter(function(s){ return s.season_number >= 1 && s.episode_count > 0; });
    if (seasons.length){
      m.sp = seasons.map(function(s){ return s.season_number + ':' + s.episode_count; }).join(',');
      $('dPlayLabel').textContent = 'Play · ' + d.number_of_seasons + ' season' + (d.number_of_seasons > 1 ? 's' : '');
      liveSeasonPicker(m, seasons);
    }
  }
}
function liveCert(d, t){
  try {
    if (t === 's' && d.content_ratings && d.content_ratings.results){
      for (var i = 0; i < d.content_ratings.results.length; i++)
        if (d.content_ratings.results[i].iso_3166_1 === 'US') return d.content_ratings.results[i].rating || '';
    }
    if (d.release_dates && d.release_dates.results){
      for (var j = 0; j < d.release_dates.results.length; j++){
        if (d.release_dates.results[j].iso_3166_1 !== 'US') continue;
        var rd = d.release_dates.results[j].release_dates || [];
        for (var k = 0; k < rd.length; k++) if (rd[k].certification) return rd[k].certification;
      }
    }
  } catch(e){}
  return '';
}
function liveSimRow(d){
  var items = (d.results || []).filter(function(r){ return r.poster_path; }).slice(0, 14);
  if (!items.length) return;
  var html = '<div class="sim-title">More like this</div><div class="sim-row">';
  items.forEach(function(r){
    var meta = tmToMeta(r);
    LIVE[meta.lk] = meta;
    html += '<button class="sim-card" onclick="openLive(\'' + meta.lk + '\')">' +
      '<img class="sp" loading="lazy" alt="" src="' + tmdbImg(meta.p, 'w185') + '" onerror="tmdbImgErr(this)"/>' +
      '<div class="sn">' + esc(meta.n) + '</div></button>';
  });
  $('liveExtras').insertAdjacentHTML('beforeend', html + '</div>');
}
function liveSeasonPicker(m, seasons){
  var html = '<div class="ep-tools"><label>Episodes</label><select id="epSel">';
  seasons.forEach(function(s){
    html += '<option value="' + s.season_number + '">' + esc(s.name || ('Season ' + s.season_number)) + ' · ' + s.episode_count + ' ep</option>';
  });
  html += '</select></div><div class="ep-list" id="epList"><div class="ep-sub" style="padding:6px 2px">Pick a season to load episodes…</div></div>';
  $('liveExtras').insertAdjacentHTML('afterbegin', html);
  $('epSel').onchange = function(){ liveLoadEpisodes(m, parseInt(this.value, 10) || 1); };
  liveLoadEpisodes(m, seasons[0].season_number);
}
function liveLoadEpisodes(m, sn){
  var box = $('epList');
  if (!box) return;
  box.innerHTML = '<div class="ep-sub" style="padding:6px 2px">Loading season ' + sn + '…</div>';
  var my = dSeq;
  tmdb('/tv/' + m.tm + '/season/' + sn).then(function(d){
    if (my !== dSeq || !d || !d.episodes){ if (box) box.innerHTML = '<div class="ep-sub" style="padding:6px 2px">Episodes unavailable.</div>'; return; }
    var html = '';
    d.episodes.forEach(function(ep){
      var name = ep.name || ('Episode ' + ep.episode_number);
      var air = ep.air_date || '';
      var sub = (air ? air + (ep.vote_average ? ' · ★ ' + Math.round(ep.vote_average * 10) / 10 : '') : '');
      html += '<button class="ep-item" onclick="playEpisode(' + sn + ',' + ep.episode_number + ')">' +
        '<span class="ep-num">' + ep.episode_number + '</span>' +
        '<span class="ep-body"><span class="ep-name">' + esc(name) + '</span><span class="ep-sub">' + esc(sub) + '</span></span>' +
        '<span class="ep-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span></button>';
    });
    box.innerHTML = html;
  }).catch(function(){ if (box) box.innerHTML = '<div class="ep-sub" style="padding:6px 2px">Episodes unavailable — the lane dropped. Try again.</div>'; });
}
function playEpisode(s, e){
  if (!currentMeta) return;
  currentSE = { s: s, e: e };
  saveSE(currentMeta.i, s, e);
  openPlayer(currentMeta);
}
/* ---- live boot probe ---- */
function liveUp(){
  liveOK = true; liveMode = true; cat = 'top';
  renderGenrePills();
  backToBrowse();
}
function initLive(){
  try { if (localStorage.getItem(LS_TM.PREF) === 'wisp') liveLane = 'wisp'; } catch(e){}
  setNet('wait', 'TMDB: connecting…');
  tmdb('/trending/all/day').then(function(d){
    if (!d || !d.results) throw new Error('bad payload');
    liveUp();
  }).catch(function(){
    if (liveLane === 'wisp'){
      /* wisp was preferred but died — give direct one clean shot */
      liveLane = 'direct';
      tmdb('/trending/all/day').then(function(d){
        if (d && d.results) liveUp();
        else throw new Error('bad payload');
      }).catch(function(){
        liveLane = 'wisp'; liveOK = false;
        setNet('bad', 'TMDB unreachable — vault mode');
      });
    } else {
      liveOK = false;
      setNet('bad', 'TMDB unreachable — vault mode');
    }
  });
  tmdb('/genre/movie/list').then(function(d){
    if (d && d.genres && d.genres.length){
      GM_GEN = d.genres.map(function(g){ return { id: g.id, n: g.name }; });
      if (liveOK) renderGenrePills();
    }
  }).catch(function(){});
  tmdb('/genre/tv/list').then(function(d){
    if (d && d.genres && d.genres.length) GTV_GEN = d.genres.map(function(g){ return { id: g.id, n: g.name }; });
  }).catch(function(){});
}
function tmdbTest(){
  var el = $('tmdbLaneInfo');
  if (el) el.textContent = 'Probing lanes…';
  var t0 = Date.now();
  fetch('https://' + TMDB_HOST + '/3/configuration', { headers: { accept: 'application/json', Authorization: 'Bearer ' + TMDB_TOKEN } })
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(){
      liveLane = 'direct'; liveOK = true;
      try { localStorage.setItem(LS_TM.PREF, 'direct'); } catch(e){}
      if (el) el.textContent = 'Direct lane OK in ' + (Date.now() - t0) + 'ms — TMDB is not blocked on this network.';
      setNet('ok', 'TMDB live · direct');
    })
    .catch(function(){
      var t1 = Date.now(), order = laneOrder();
      wispHttpGet(order[0], '/configuration?language=en-US', function(ok){
        if (ok){
          liveOK = true; liveLane = 'wisp';
          try { localStorage.setItem(LS_TM.LANE, order[0]); localStorage.setItem(LS_TM.PREF, 'wisp'); } catch(e){}
          if (el) el.textContent = 'Direct blocked (school wifi does that) — the wisp tunnel carried TMDB in ' + (Date.now() - t1) + 'ms via ' + laneName(order[0]) + '. Lane saved.';
          setNet('ok', 'TMDB live · wisp (' + laneName(order[0]) + ')');
          if (liveMode){ renderGenrePills(); } else { liveMode = true; backToBrowse(); }
        } else if (el) {
          el.textContent = 'Both lanes failed just now — vault mode stays. Streams are unaffected; try again later.';
        }
      });
    });
}

/* ================================================================
   SITES VAULT — confirmed sources + wisp-tested sites + lane prober
   ================================================================ */''')

# ------------------------------------------------------------------ 8. setCat vault branch
rep('''function setCat(c, el){
  cat = c;
  var pills = $('catPills').children;
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  if (el) el.classList.add('active');
  backToBrowse();
}''',
    '''function setCat(c, el){
  cat = c;
  var pills = $('catPills').children;
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  if (el) el.classList.add('active');
  if (c === 'vault') liveMode = false; else if (liveOK) liveMode = true;
  backToBrowse();
}''')

# ------------------------------------------------------------------ 9. backToBrowse branch
rep('''function backToBrowse(){
  mode = 'browse'; done = false; skip = 0;
  setState('');
  clearGrid();
  rebuildView();
  loadPage();
}''',
    '''function backToBrowse(){
  setState('');
  clearGrid();
  done = false; skip = 0;
  tmDone = false; tmFetching = false;
  if (liveMode && liveOK){
    mode = 'tmcat'; tmPage = 1;
    liveLoadPage();
    return;
  }
  mode = 'browse';
  rebuildView();
  loadPage();
}''')

# ------------------------------------------------------------------ 10. loadPage branch
rep('''function loadPage(){
  if (done || mode !== 'browse') return;''',
    '''function loadPage(){
  if (done) return;
  if (mode === 'tmcat' || mode === 'tmsearch'){ liveLoadPage(); return; }
  if (mode !== 'browse') return;''')

# ------------------------------------------------------------------ 11. doSearch live-aware
rep('''/* ---------- search (local, instant) ---------- */
function doSearch(q){
  var seq = ++searchSeq;
  mode = 'search'; done = true;
  clearGrid();
  var ql = q.toLowerCase();
  var res = [];
  var pool = MOV.concat(SER);
  for (var i = 0; i < pool.length; i++){
    var nm = (pool[i].n || '').toLowerCase();
    if (nm.indexOf(ql) > -1) res.push(pool[i]);
  }
  res.sort(function(a, b){
    var sa = a.n.toLowerCase().indexOf(ql) === 0 ? 1 : 0;
    var sb = b.n.toLowerCase().indexOf(ql) === 0 ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.r || 0) - (a.r || 0);
  });
  if (seq !== searchSeq) return;
  if (!res.length){
    setState('<div class="big">🍿</div>Nothing found for \u201C' + esc(q) + '\u201D<br><span style="font-size:.8rem">The on-device catalog holds ' + (MOV.length + SER.length) + ' titles \u2014 try a shorter query.</span>');
    return;
  }
  setState('');
  clearGrid();
  renderBatch(res, 0, Math.min(res.length, 120));
}''',
    '''/* ---------- search (TMDB live when a lane is up, vault otherwise) ---------- */
function doSearch(q){
  clearGrid(); setState('');
  if (liveOK){
    mode = 'tmsearch'; done = false; tmDone = false; tmFetching = false;
    tmPage = 1; tmQuery = q;
    liveLoadPage();
    return;
  }
  mode = 'search'; done = true;
  var res = localMatches(q);
  if (!res.length){
    setState('<div class="big">🍿</div>Nothing found for \u201C' + esc(q) + '\u201D<br><span style="font-size:.8rem">The on-device catalog holds ' + (MOV.length + SER.length) + ' titles \u2014 try a shorter query.</span>');
    return;
  }
  setState('');
  clearGrid();
  renderBatch(res, 0, Math.min(res.length, 120));
}''')

# ------------------------------------------------------------------ 12. renderGenrePills live branch
rep('''function renderGenrePills(){
  var list = (kind === 'movie') ? (CAT ? CAT.gm : []) : (CAT ? CAT.gs : []);''',
    '''function renderGenrePills(){
  if (liveOK){
    var lg = (kind === 'movie') ? GM_GEN : GTV_GEN;
    $('genrePills').innerHTML = lg.map(function(g){
      return '<button class="pill' + (g.n === genre ? ' active' : '') + '" data-g="' + esc(g.n) + '" onclick="setGenre(\\\'' + esc(g.n).replace(/'/g, "\\\\'") + '\\',this)">' + esc(g.n) + '</button>';
    }).join('');
    return;
  }
  var list = (kind === 'movie') ? (CAT ? CAT.gm : []) : (CAT ? CAT.gs : []);''')

# ------------------------------------------------------------------ 13. cardHTML live img + openLive
rep('''  var sub = esc(m.y || '') + (type === 'series' ? ' · Series' : '');
  return '<div class="mcard" onclick="openDetail(\\\'' + esc(m.i) + '\\\',\\\'' + type + '\\\')">' +
    '<div class="poster">' + typeb + '<div class="mp"></div><div class="ph" data-l="' + esc((m.n || '?').charAt(0).toUpperCase()) + '"></div>' + rating + '</div>' +
    '<div class="mname">' + esc(m.n) + '</div><div class="msub">' + sub + '</div></div>';'''.replace('\\\\', '\\'),
    '''  var sub = esc(m.y || '') + (type === 'series' ? ' · Series' : '');
  var img = m.p ? '<img class="timg" loading="lazy" alt="" src="' + tmdbImg(m.p, 'w342') + '" onerror="tmdbImgErr(this)"/>' : '';
  var click = m.lk ? 'openLive(\\\'' + esc(m.lk) + '\\\')' : 'openDetail(\\\'' + esc(m.i) + '\\\',\\\'' + type + '\\\')';
  return '<div class="mcard" onclick="' + click + '">' +
    '<div class="poster">' + typeb + '<div class="mp"></div><div class="ph" data-l="' + esc((m.n || '?').charAt(0).toUpperCase()) + '"></div>' + img + rating + '</div>' +
    '<div class="mname">' + esc(m.n) + '</div><div class="msub">' + sub + '</div></div>';'''.replace('\\\\', '\\'))

# ------------------------------------------------------------------ 14. openDetail live guard + poster reset
rep('''function openDetail(id, type){
  var m = BYID[id];''',
    '''function openDetail(id, type){
  if (id && id.indexOf(':') > -1 && LIVE[id]){ openLive(id); return; }
  var m = BYID[id];''')

rep('''  var poster = $('dPoster');
  poster.classList.remove('noimg');
  fillSprite(poster, m);''',
    '''  var poster = $('dPoster');
  poster.innerHTML = '';
  poster.classList.remove('noimg');
  fillSprite(poster, m);''')

# ------------------------------------------------------------------ 15. closeDetail clears extras
rep("function closeDetail(){ $('detailOverlay').classList.remove('open'); }",
    "function closeDetail(){ dSeq++; $('detailOverlay').classList.remove('open'); var lx = $('liveExtras'); if (lx) lx.innerHTML = ''; }")

# ------------------------------------------------------------------ 16. resumeItem LIVE branch
rep('''function resumeItem(id, type){
  openDetail(id, type);
  playCurrent();
}''',
    '''function resumeItem(id, type){
  if (LIVE[id]){ openLive(id); return; }
  openDetail(id, type);
  playCurrent();
}''')

# ------------------------------------------------------------------ 17. renderHistory live posters
rep('''    var it = BYID[h[i].id];
    if (mp) paintSprite(mp, it ? it.x : -1);''',
    '''    var it = BYID[h[i].id] || LIVE[h[i].id] || (h[i].p ? { p: h[i].p } : null);
    if (it && it.p && mp){
      mp.style.display = 'none';
      var im = document.createElement('img');
      im.className = 'timg'; im.loading = 'lazy'; im.alt = '';
      im.src = tmdbImg(it.p, 'w185');
      im.onerror = function(){ im.style.display = 'none'; };
      mp.parentNode.appendChild(im);
    } else if (mp) paintSprite(mp, it ? it.x : -1);''')

# ------------------------------------------------------------------ 18. pushHistory poster field
rep("h.unshift({ id: m.i, name: m.n, type: m.t === 's' ? 'series' : 'movie', year: m.y || '', s: s || null, e: e || null, ts: Date.now() });",
    "h.unshift({ id: m.i, name: m.n, type: m.t === 's' ? 'series' : 'movie', year: m.y || '', s: s || null, e: e || null, p: m.p || null, ts: Date.now() });")

# ------------------------------------------------------------------ 19. initSearch tmsearch reset
rep("      if (mode === 'search') backToBrowse();",
    "      if (mode === 'search' || mode === 'tmsearch') backToBrowse();")

# ------------------------------------------------------------------ 20. boot initLive
rep('''  if (window.FATE_MOVIES_B64){
    decodeCat(afterCatalog);
  } else {
    window.__catCDN();
  }
});''',
    '''  if (window.FATE_MOVIES_B64){
    decodeCat(afterCatalog);
  } else {
    window.__catCDN();
  }
  try { initLive(); } catch(e){}
});''')

# ------------------------------------------------------------------ 21. vault overlay: TMDB section
rep('''      <div class="s-sec">⚙ Engine <small>· used for "Engine" opens \u2014 gn-math.html next to this page</small></div>''',
    '''      <div class="s-sec">🔎 TMDB data lane <small>· the milkbox.japan.is method — the same public v4 read token their app ships</small></div>
      <p class="p-hint" style="padding:0 0 8px"><span id="tmdbLaneInfo">Status line fills in after the page connects.</span></p>
      <div class="sbtns"><button onclick="tmdbTest()" style="flex:0 0 auto;min-width:130px">⚡ Test TMDB lane</button><button onclick="tmdbCacheClear()" style="flex:0 0 auto;min-width:130px">Clear TMDB cache</button></div>
      <div class="s-sec">⚙ Engine <small>· used for "Engine" opens \u2014 gn-math.html next to this page</small></div>''')

# ------------------------------------------------------------------ 22. openSites refresh lane info
rep('''function openSites(){
  $('sitesOverlay').classList.add('open');
  if (!$('youGrid').innerHTML) renderVault();
  try { $('engUrl').value = localStorage.getItem(LS_ENG) || ''; } catch(e){}
}''',
    '''function openSites(){
  $('sitesOverlay').classList.add('open');
  if (!$('youGrid').innerHTML) renderVault();
  try { $('engUrl').value = localStorage.getItem(LS_ENG) || ''; } catch(e){}
  var ti = $('tmdbLaneInfo');
  if (ti && liveOK) ti.textContent = 'Status: live via the ' + (liveLane === 'direct' ? 'DIRECT' : 'WISP TUNNEL') + ' lane. If TMDB ever gets blocked here, hit Test — the wisp tunnel carries it the same way the engine does.';
}''')

F.write_text(html, encoding='utf-8')
print('movies.html upgraded to v2.4:', F.stat().st_size, 'bytes')
