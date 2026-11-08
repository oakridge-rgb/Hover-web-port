#!/usr/bin/env python3
"""FATE Movies v2.3 builder — the SEPARATE movie page (not packed into FATE.html).

Upgrades download/fate-movies2/movies.html (v2.2) -> download/site/movies.html:
  * Server ring: VidZee (peak) [user-confirmed primary] + MILKBOX (milky.japan.is,
    unblocked for the user, carries the x8rr Movies server), then the v2.2 six.
  * New "Sites vault" overlay: confirmed-by-you cards, the 32 wisp-tested movie
    sites (MOVIE-SITES.txt, Nov 8 2026), the 11 bot-wall sites, a live wisp lane
    prober (the engine's own wisp client, browser build) and an engine-URL override.
  * Engine opens go through gn-math.html#open=<url> (same deep link the FATE
    Apps module uses), so every site in the vault rides the wisp tunnel.
  * Side-rail "Movies" link in site/index.html.
"""
import pathlib, shutil, sys

SRC   = pathlib.Path('/home/z/my-project/download/fate-movies2/movies.html')
OUT   = pathlib.Path('/home/z/my-project/download/site/movies.html')
SITE  = pathlib.Path('/home/z/my-project/download/site')
INDEX = SITE / 'index.html'

html = SRC.read_text(encoding='utf-8')

def rep(old, new, count=1):
    global html
    n = html.count(old)
    if n != count:
        sys.exit('ANCHOR FAIL (%dx, want %d): %r' % (n, count, old[:100]))
    html = html.replace(old, new)

# ------------------------------------------------------------------ 1. version
rep('FATE MOVIES 2.2 \xe2 blockproof static catalog + StormOS player'
    if False else
    '   FATE MOVIES 2.2 \u2014 blockproof static catalog + StormOS player',
    '   FATE MOVIES 2.3 \u2014 VidZee (peak) primary + MILKBOX + wisp site vault')

# ------------------------------------------------------------------ 2. player hint
rep('<p class="p-hint">Every server here was live-tested with a real player. A dead stream auto-switches to the next one after 12 seconds \u2014 or tap any server to switch instantly.</p>',
    '<p class="p-hint">Chips 1\u20132 are your confirmed ones (Nov 9 2026): <b>VidZee (peak)</b> and <b>MILKBOX \u00b7 x8rr</b> on milky.japan.is. A dead stream auto-switches to the next chip after 12 seconds \u2014 or tap any server to switch instantly.</p>')

# ------------------------------------------------------------------ 3. nav link
rep('<a class="nav-link" href="games.html">Games</a>',
    '<a class="nav-link" href="#" onclick="openSites();return false">Sites</a>\n      <a class="nav-link" href="games.html">Games</a>')

# ------------------------------------------------------------------ 4. fab item
rep('''<a href="tv.html" class="fab-item"><svg viewBox="0 0 24 24"><path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4z"/></svg><span>Live TV</span></a>''',
    '''<a href="tv.html" class="fab-item"><svg viewBox="0 0 24 24"><path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4z"/></svg><span>Live TV</span></a>
    <a href="#" class="fab-item" onclick="openSites();return false"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7.93 9h-3.02a15.7 15.7 0 0 0-1.2-5.32A8.02 8.02 0 0 1 19.93 11zM12 4.07c.83 1.2 1.62 3.2 1.87 5.93h-3.74c.25-2.73 1.04-4.73 1.87-5.93zM4.07 13h3.02c.14 1.96.55 3.76 1.2 5.32A8.02 8.02 0 0 1 4.07 13zm3.02-2H4.07a8.02 8.02 0 0 1 4.22-5.32A15.7 15.7 0 0 0 7.09 11zM12 19.93c-.83-1.2-1.62-3.2-1.87-5.93h3.74c-.25 2.73-1.04 4.73-1.87 5.93zm2.26-7.93H9.74c.26-2.87 1.1-5.1 2.26-6.36 1.16 1.26 2 3.49 2.26 6.36zm1.45 8.32c.65-1.56 1.06-3.36 1.2-5.32h3.02a8.02 8.02 0 0 1-4.22 5.32z"/></svg><span>Sites vault</span></a>''')

# ------------------------------------------------------------------ 5. sites overlay HTML
rep('<div class="fab-backdrop" id="fabBackdrop" onclick="toggleFab()"></div>',
    r'''<!-- SITES VAULT -->
<div class="overlay" id="sitesOverlay" onclick="if(event.target===this)closeSites()">
  <div class="sheet">
    <button class="sheet-close" onclick="closeSites()">✕</button>
    <div class="p-head"><h3>🌐 <span>Movie sites vault</span></h3></div>
    <div class="sites-wrap">
      <div class="s-sec">★ Confirmed by you <small>· your network · Nov 9 2026</small></div>
      <div class="sgrid" id="youGrid"></div>
      <div class="s-sec">✅ Working on the FATE wisp <small>· 32 sites · tested Nov 8 over the engine's own lanes</small></div>
      <div class="sgrid" id="okGrid"></div>
      <div class="s-sec">⚠ Reachable but bot-walled <small>· Cloudflare check first — worth one try through the Browser module</small></div>
      <div class="sgrid" id="botGrid"></div>
      <div class="s-sec">🛰 Wisp lanes <small>· live probe — the engine failovers between these on its own</small></div>
      <div class="lanes" id="laneRow"></div>
      <div class="sbtns" style="margin-top:10px"><button onclick="probeLanes()" style="flex:0 0 auto;min-width:120px">⚡ Probe lanes</button><button onclick="clearMarks()" style="flex:0 0 auto;min-width:120px">Clear ✓/✗ marks</button></div>
      <div class="s-sec">⚙ Engine <small>· used for "Engine" opens — gn-math.html next to this page</small></div>
      <div class="engrow"><input id="engUrl" placeholder="gn-math.html  (or a full https:// URL to a hosted engine)"/><button onclick="saveEngine()">Save</button></div>
      <p class="p-hint" style="padding:12px 0 0"><b>Engine</b> opens go through <b>gn-math.html#open=…</b> — the same wisp tunnel the Apps module uses, with endpoint failover built in. <b>Direct</b> opens skip the tunnel: use them for sites that are not blocked on your network (like MILKBOX). ✓/✗ marks are remembered on this device so you always know which sites made the cut.</p>
    </div>
  </div>
</div>

<div class="fab-backdrop" id="fabBackdrop" onclick="toggleFab()"></div>''')

# ------------------------------------------------------------------ 6. sites CSS
rep('</style>',
    r'''/* ===== sites vault ===== */
.sites-wrap{padding:2px 22px 26px}
.s-sec{margin:18px 0 9px;font-family:"Space Grotesk",sans-serif;font-size:.98rem;font-weight:700;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.s-sec small{color:var(--text-muted);font-weight:500;font-size:.72rem}
.sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.scard{background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:14px;padding:12px 13px;display:flex;flex-direction:column;gap:7px;transition:border-color .25s,opacity .25s}
.sc-top{display:flex;justify-content:space-between;gap:8px;align-items:center;min-width:0}
.sname{font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sbadge{flex:0 0 auto;font-size:.56rem;font-weight:800;letter-spacing:.07em;padding:3px 8px;border-radius:8px;text-transform:uppercase;white-space:nowrap}
.sbadge.ok{background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.3)}
.sbadge.you{background:rgba(var(--primary-rgb),0.14);color:var(--primary-soft);border:1px solid rgba(var(--primary-rgb),0.4)}
.sbadge.bot{background:rgba(234,179,8,0.1);color:#facc15;border:1px solid rgba(234,179,8,0.25)}
.shost{font-size:.73rem;color:var(--primary-soft);word-break:break-all}
.snote{font-size:.72rem;color:#94a3b8;line-height:1.5}
.sbtns{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.sbtns button{flex:1;min-width:56px;padding:8px 8px;border-radius:9px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text);font-size:.73rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s}
.sbtns button:hover{border-color:rgba(var(--primary-rgb),0.5);color:var(--primary-soft)}
.sbtns button.mk{flex:0 0 40px;min-width:40px}
.scard.m-ok{border-color:rgba(16,185,129,0.5)}
.scard.m-ok .mk.ok{background:rgba(16,185,129,0.25);border-color:rgba(16,185,129,0.6);color:#34d399}
.scard.m-bad{border-color:rgba(239,68,68,0.5);opacity:.78}
.scard.m-bad .mk.bad{background:rgba(239,68,68,0.25);border-color:rgba(239,68,68,0.6);color:#f87171}
.lanes{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.lane{display:inline-flex;align-items:center;gap:7px;padding:8px 12px;border-radius:10px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.03);font-size:.72rem;font-weight:600;color:var(--text-muted)}
.lane .ld{width:8px;height:8px;border-radius:50%;background:#475569;flex:0 0 auto}
.lane.p-ok .ld{background:#10b981;box-shadow:0 0 8px #10b981}
.lane.p-bad .ld{background:#ef4444}
.lane.p-run .ld{background:var(--primary);animation:sp .7s linear infinite}
.lane .lms{color:#94a3b8;font-size:.64rem}
.engrow{display:flex;gap:8px}
.engrow input{flex:1;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid var(--glass-border);color:var(--text);font-size:.82rem;outline:none;font-family:inherit}
.engrow input:focus{border-color:rgba(var(--primary-rgb),0.4)}
.engrow button{flex:0 0 auto;min-width:84px;padding:10px 14px;border-radius:10px;border:1px solid var(--glass-border);background:rgba(var(--primary-rgb),0.12);color:var(--primary-soft);font-weight:700;font-size:.8rem;cursor:pointer;font-family:inherit}
@media(max-width:760px){.sgrid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}.sites-wrap{padding:2px 14px 20px}}
</style>''')

# ------------------------------------------------------------------ 7. Escape closes vault
rep("if (e.key === 'Escape'){ closePlayer(); closeDetail(); }",
    "if (e.key === 'Escape'){ closePlayer(); closeDetail(); closeSites(); }")

# ------------------------------------------------------------------ 8. providers comment
rep(r'''/* ---------- providers ----------
   VERIFIED-ALIVE set — every entry below was probed with a real headless
   browser (Nov 2025) and rendered an actual player: vidsrc.pm (StormOS's
   2026 primary), cinesrc.st, yapgrid.com, 2embed.cc, vidlink.pro.
   The rest of StormOS's 29-server lineup was pruned: vidsrc.to (dead shell),
   vidsrc.xyz/.sbs/.in (DNS gone), vidrock/vidsrcme.ru (refused), vidcore
   (timeout), vidsrc.io (parked), videasy (empty), embedflix (redirect loop),
   vidphantom (Cloudflare wall) — dead entries made the 12s auto-fallback
   cycle through corpses and feel like "nothing works". tmdb:1 = URL uses
   the catalog's TMDB id (tm field); the IMDb-based Vidlink stays as the
   universal fallback for the 2 titles without a TMDB id. */''',
    r'''/* ---------- providers ----------
   Chips 1-2 are USER-CONFIRMED (Nov 9 2026, on the school network):
     1. VidZee (peak)  — player.vidzee.wtf, TMDB-id embeds; the primary
        server inside MILKBOX's "x8rr Movies" chain that the user verified.
     2. MILKBOX · x8rr — milky.japan.is is NOT blocked for the user; the
        site aggregates 40+ sources (its server ring includes "x8rr Movies
        (Direct Stream / Ad-Free HLS)" and "VidZee (player.vidzee.wtf)").
        Player routes /movie/{tmdb} and /tv/{tmdb} if cleanly (no XFO).
   Then the v2.2 VERIFIED-ALIVE set — vidsrc.pm, cinesrc.st, yapgrid.com,
   2embed.cc, vidlink.pro — every entry probed with a real headless browser.
   tmdb:1 = URL uses the catalog's TMDB id (tm field); the IMDb-based
   Vidlink stays as the universal fallback for the 2 titles without one. */''')

# ------------------------------------------------------------------ 9. PROVIDERS array
rep(r'''var PROVIDERS = [
  P('vidsrc', 'VidSpark', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.pm/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.pm/embed/movie/'+id; }),''',
    r'''var PROVIDERS = [
  P('vidzee', 'VidZee (peak) ★', 1, function(t,id,s,e){ return t==='series' ? 'https://player.vidzee.wtf/embed/tv/'+id+'/'+s+'/'+e : 'https://player.vidzee.wtf/embed/movie/'+id; }),
  P('milkbox', 'MILKBOX · x8rr ★', 1, function(t,id,s,e){ return t==='series' ? 'https://milky.japan.is/tv/'+id : 'https://milky.japan.is/movie/'+id; }),
  P('vidsrc', 'VidSpark', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.pm/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.pm/embed/movie/'+id; }),''')

# ------------------------------------------------------------------ 10. sites vault JS
rep('/* ---------- boot (every step guarded) ---------- */',
    r'''/* ================================================================
   SITES VAULT — confirmed sources + wisp-tested sites + lane prober
   ================================================================ */
var LS_MARKS = 'fate_movies_marks', LS_ENG = 'fate_movies_engine';

/* your two confirmations (Nov 9 2026) */
var SITES_YOU = [
  { n: 'MILKBOX', h: 'milky.japan.is', b: 'UNBLOCKED FOR YOU',
    d: 'Full hub: movies, TV, anime, manga. Its server ring carries \u201Cx8rr Movies (Direct Stream)\u201D and \u201CVidZee (player.vidzee.wtf)\u201D \u2014 the exact setup you confirmed. Also wired in as player chip #2; the player pages iframed cleanly (no X-Frame-Options).' },
  { n: 'VidZee (peak)', h: 'player.vidzee.wtf', b: 'PLAYER #1 \u2605',
    d: 'TMDB-id embed provider \u2014 your confirmed primary server. Sits first in the in-page player ring; dead streams auto-hop to the next chip.' },
  { n: 'x8rr / movies', h: 'github.com/x8rr/movies', b: 'THE SOURCE',
    d: 'The pstream-based movie API behind MILKBOX\u2019s \u201Cx8rr Movies\u201D server \u2014 scrapes VidZee, VidSrc, VidLink, VixSrc and friends in parallel and returns only alive streams.' }
];

/* tested Nov 8 2026 through the engine's own wisp client (MOVIE-SITES.txt) */
var SITES_OK = [
  ['Aether','aether.st',''],['Cinejoy','cinejoy.pk',''],['7Movies','7movies.ac',''],
  ['Atlantic','atlantic.bz',''],['Vivarium','vivarium.su',''],['CineLite','cinelite.xyz',''],
  ['Ghostflix','ghostflix.st',''],['MeowTV','meowtv.ru',''],['Reelix','reelix.ac',''],
  ['Cno','cno.to',''],['SweetFox','sweetfox.app',''],['Cinecat','cinecat.eu','JS app \u2014 blank title tag'],
  ['Flixer','flixer.gd',''],['Dulo','dulo.mov',''],['Basement','basementx.lol',''],
  ['ShuttleTV','shuttletv.su',''],['TonkaCine','tonkacine.watch',''],['Moovie','moovie.fun',''],
  ['Cineby','cinebytv.com',''],['PrimeShows','primeshows.org',''],['PressPlayZ','pressplayz.top',''],
  ['LookMovie','www.lookmovie2.to',''],['Goojara','ww1.goojara.to',''],['Levidia','www.levidia.ch',''],
  ['1Shows','www.1shows.org','JS app \u2014 blank title tag'],['ArrowTV','arrowtv.net',''],['AniCine','anicine.sbs',''],
  ['MegaCartoons','www.megacartoons.net','cartoons'],['SuperCartoons','www.supercartoons.net','cartoons'],
  ['HiAnime','hianimes.ru','anime'],
  ['Aetheris','aetheris.win','hub \u2014 the unblocked site Aetheris'],
  ['Moxy','moxy.neocities.org','hub \u2014 \u201CThe Moxy Files\u201D, landing page, archive on subpages']
];

/* answer through the lanes but bot-wall / verify-wall first */
var SITES_BOT = [
  ['PopcornMovies','popcornmovies.st'],['Chillflix','chillflix.lol'],['NEPU','nepu.io'],
  ['RidoMovies','ridomovies.is'],['HydraHD','hydrahd.gd'],['ZetMoon','zetmoon.live'],
  ['WCOStream','www.wcostream.tv'],['MoanaTV','moanatv.lfmx.app'],['FlyStream','flystream.net'],
  ['AZMovies','azmovies.to'],['Noxx','noxx.gg']
];

/* fastest lanes from the Nov 8 scan (ms to first HTTP byte) */
var LANES = [
  ['browserjs \u00b7 railway', 'wss://browserjs-production.up.railway.app/wisp/', 259],
  ['tokyo \u00b7 new-updates', 'wss://tokyo.new-updates.info/wisp/', 467],
  ['fern.best', 'wss://fern.best/wisp/', 788],
  ['linuxontab \u00b7 fly', 'wss://linuxontab-net.fly.dev/wisp/', 872],
  ['mercury \u00b7 api', 'wss://wisp.mercurywork.shop/api/wisp/', 884],
  ['mercury \u00b7 root', 'wss://wisp.mercurywork.shop/', 891],
  ['mercury \u00b7 w', 'wss://wisp.mercurywork.shop/w/', 895],
  ['mercury \u00b7 wisp', 'wss://wisp.mercurywork.shop/wisp/', 900]
];

/* ---- the engine's wisp client (libcurl-wisp classes, browser build) ---- */
var W_F = { CONNECT: 1, DATA: 2, CONTINUE: 3, CLOSE: 4 };
function wAC(a){ if (a.length === 4) return new Uint32Array(a.buffer)[0]; if (a.length === 2) return new Uint16Array(a.buffer)[0]; return a[0]; }
function wNB(v, n){ var b = new ArrayBuffer(n), d = new DataView(b); if (n === 1) d.setUint8(0, v, true); else if (n === 2) d.setUint16(0, v, true); else d.setUint32(0, v, true); return new Uint8Array(b); }
function wJoin(){ var n = 0, i; for (i = 0; i < arguments.length; i++) n += arguments[i].length; var o = new Uint8Array(n), p = 0; for (i = 0; i < arguments.length; i++){ o.set(arguments[i], p); p += arguments[i].length; } return o; }
function wPkt(t, id, pay){ return wJoin(wNB(t, 1), wNB(id, 4), pay); }
class WStream extends EventTarget {
  constructor(host, port, ws, id, conn){
    super();
    this.hostname = host; this.port = port; this.ws = ws;
    this.buffer_size = null; this.stream_id = id; this.connection = conn;
    this.stream_type = 1; this.send_buffer = []; this.open = true;
  }
  send(d){
    if (this.buffer_size > 0 || !this.open){ this.ws.send(wPkt(2, this.stream_id, d)); if (this.buffer_size > 0) this.buffer_size--; }
    else this.send_buffer.push(d);
  }
  continue_received(n){ this.buffer_size = n; while (this.buffer_size > 0 && this.send_buffer.length) this.send(this.send_buffer.shift()); }
  close(c){
    if (c === undefined) c = 1;
    if (!this.open) return;
    this.ws.send(wPkt(4, this.stream_id, wNB(c, 1)));
    this.open = false;
    delete this.connection.active_streams[this.stream_id];
  }
}
class WConn extends EventTarget {
  constructor(url){
    super();
    if (!/\/$/.test(url)) throw 'wisp endpoints must end with /';
    this.wisp_url = url; this.active_streams = {}; this.connected = false; this.connecting = true; this.next_stream_id = 1;
    var self = this;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.addEventListener('error', function(){ self.connected = false; self.dispatchEvent(new Event('error')); });
    this.ws.addEventListener('close', function(){ self.connected = false; self.dispatchEvent(new CloseEvent('close')); });
    this.ws.addEventListener('message', function(e){ self._msg(e); if (self.connecting){ self.connected = true; self.connecting = false; self.dispatchEvent(new Event('open')); } });
  }
  create_stream(host, port){
    var id = this.next_stream_id++;
    var s = new WStream(host, port, this.ws, id, this);
    s.open = this.connected;
    this.active_streams[id] = s;
    this.ws.send(wPkt(1, id, wJoin(wNB(1, 1), wNB(port, 2), new TextEncoder().encode(host))));
    return s;
  }
  _msg(e){
    var i = new Uint8Array(e.data);
    if (i.length < 5) return;
    var t = i[0], id = wAC(i.slice(1, 5)), pl = i.slice(5), s = this.active_streams[id];
    if (!s && id !== 0) return;
    if (t === W_F.DATA) s.dispatchEvent(new MessageEvent('message', { data: pl }));
    else if (t === W_F.CONTINUE && id === 0) this.max_buffer = wAC(pl);
    else if (t === W_F.CONTINUE) s.continue_received(wAC(pl));
    else if (t === W_F.CLOSE){ s.open = false; s.dispatchEvent(new CloseEvent('close', { code: pl[0] })); delete this.active_streams[id]; }
  }
}

/* ---- vault UI ---- */
function engineURL(){ try { return localStorage.getItem(LS_ENG) || 'gn-math.html'; } catch(e){ return 'gn-math.html'; } }
function openViaEngine(url){ window.open(engineURL() + '#open=' + encodeURIComponent(url), '_blank'); }
function openDirect(url){ window.open(url, '_blank', 'noopener'); }
function siteEngine(h){ openViaEngine('https://' + h); }
function siteDirect(h){ openDirect('https://' + h); }
function openSites(){
  $('sitesOverlay').classList.add('open');
  if (!$('youGrid').innerHTML) renderVault();
  try { $('engUrl').value = localStorage.getItem(LS_ENG) || ''; } catch(e){}
}
function closeSites(){ $('sitesOverlay').classList.remove('open'); }
function saveEngine(){
  var v = ($('engUrl').value || '').trim() || 'gn-math.html';
  try { localStorage.setItem(LS_ENG, v); } catch(e){}
  toast('Engine set: ' + v);
}
function getMarks(){ try { return JSON.parse(localStorage.getItem(LS_MARKS) || '{}'); } catch(e){ return {}; } }
function setMarks(m){ try { localStorage.setItem(LS_MARKS, JSON.stringify(m)); } catch(e){} }
function markSite(host, val, btn){
  var m = getMarks();
  if (m[host] === val) delete m[host]; else m[host] = val;
  setMarks(m);
  applyMark(host, m[host]);
}
function clearMarks(){ setMarks({}); document.querySelectorAll('.scard[data-host]').forEach(function(c){ c.classList.remove('m-ok','m-bad'); }); toast('Marks cleared'); }
function applyMark(host, val){
  var card = document.querySelector('.scard[data-host="' + host + '"]');
  if (!card) return;
  card.classList.remove('m-ok', 'm-bad');
  if (val === 'ok') card.classList.add('m-ok');
  if (val === 'bad') card.classList.add('m-bad');
}
function scard(name, host, badge, cls, note, noMark){
  return '<div class="scard' + (cls ? ' ' + cls : '') + '" data-host="' + esc(host) + '">' +
    '<div class="sc-top"><span class="sname">' + esc(name) + '</span><span class="sbadge ' + badge[0] + '">' + badge[1] + '</span></div>' +
    '<div class="shost">' + esc(host) + '</div>' +
    (note ? '<div class="snote">' + esc(note) + '</div>' : '') +
    '<div class="sbtns">' +
    '<button onclick="siteEngine(\'' + host + '\')">Engine</button>' +
    '<button onclick="siteDirect(\'' + host + '\')">Direct</button>' +
    (noMark ? '' :
      '<button class="mk ok" title="works for me" onclick="markSite(\'' + host + '\',\'ok\')">✓</button>' +
      '<button class="mk bad" title="dead for me" onclick="markSite(\'' + host + '\',\'bad\')">✗</button>') +
    '</div></div>';
}
function renderVault(){
  $('youGrid').innerHTML = SITES_YOU.map(function(s){
    var cls = 'm-ok';
    return scard(s.n, s.h, ['you', s.b], cls, s.d, true);
  }).join('');
  $('okGrid').innerHTML = SITES_OK.map(function(s){ return scard(s[0], s[1], ['ok', 'wisp ok'], '', s[2], false); }).join('');
  $('botGrid').innerHTML = SITES_BOT.map(function(s){ return scard(s[0], s[1], ['bot', 'bot wall'], '', '', false); }).join('');
  $('laneRow').innerHTML = LANES.map(function(l, i){
    return '<span class="lane" id="lane' + i + '" title="' + esc(l[1]) + '"><span class="ld"></span>' + esc(l[0]) + ' <span class="lms">~' + l[2] + 'ms</span></span>';
  }).join('') + '';
  var m = getMarks();
  Object.keys(m).forEach(function(h){ applyMark(h, m[h]); });
}

/* ---- live lane prober (plain HTTP via the wisp tunnel) ---- */
function probeOne(ep, cb){
  var t0 = Date.now(), done = false, conn = null;
  function fin(ok, err){
    if (done) return; done = true;
    try { if (conn && conn.ws) conn.ws.close(); } catch(e){}
    cb(ok, Date.now() - t0, err);
  }
  var to = setTimeout(function(){ fin(false, 'timeout'); }, 9000);
  try { conn = new WConn(ep); } catch(e){ clearTimeout(to); return fin(false, 'ctor'); }
  conn.addEventListener('open', function(){
    var s;
    try { s = conn.create_stream('example.com', 80); } catch(e){ clearTimeout(to); return fin(false, 'stream'); }
    s.addEventListener('message', function(e){
      var txt = '';
      try { txt = new TextDecoder().decode(e.data.slice(0, 16)); } catch(err){}
      if (txt.indexOf('HTTP') === 0){ clearTimeout(to); fin(true); }
    });
    s.addEventListener('close', function(){ if (!done){ clearTimeout(to); fin(false, 'closed'); } });
    try { s.send(new TextEncoder().encode('GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n')); }
    catch(err){ clearTimeout(to); fin(false, 'send'); }
  });
  conn.addEventListener('error', function(){ clearTimeout(to); fin(false, 'ws error'); });
  conn.addEventListener('close', function(){ if (!done){ clearTimeout(to); fin(false, 'ws closed'); } });
}
function probeLanes(){
  LANES.forEach(function(l, i){
    var el = $('lane' + i);
    el.classList.remove('p-ok', 'p-bad'); el.classList.add('p-run');
    var ms = el.querySelector('.lms'); ms.textContent = '…';
    probeOne(l[1], function(ok, t){
      el.classList.remove('p-run');
      if (ok){ el.classList.add('p-ok'); ms.textContent = t + 'ms'; }
      else { el.classList.add('p-bad'); ms.textContent = 'dead'; }
    });
  });
}

/* ---------- boot (every step guarded) ---------- */''')

# ------------------------------------------------------------------ write + copy assets
OUT.write_text(html, encoding='utf-8')
shutil.copyfile(SITE.parent / 'fate-movies2' / 'fate-movies-cat.js', SITE / 'fate-movies-cat.js')
ms_src = SITE.parent / 'fate-movies2' / 'msheets'
ms_dst = SITE / 'msheets'
if not ms_dst.exists():
    shutil.copytree(ms_src, ms_dst)
print('movies.html written:', OUT, OUT.stat().st_size, 'bytes')

# ------------------------------------------------------------------ index.html side-rail link
idx = INDEX.read_text(encoding='utf-8')
link = '''<a href="w.html" class="side-link" data-label="Watch">
  <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM13 8l-4 4 4 4V8z"/></svg>
</a>'''
movies_link = '''<a href="movies.html" class="side-link" data-label="Movies">
  <svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
</a>'''
if 'href="movies.html"' not in idx:
    n = idx.count(link)
    if n != 1:
        sys.exit('INDEX ANCHOR FAIL (%d): Watch side-link' % n)
    idx = idx.replace(link, link + '\n' + movies_link)
    INDEX.write_text(idx, encoding='utf-8')
    print('index.html: Movies side-link added')
else:
    print('index.html: Movies link already present')

print('OK')
