/* ================================================================
   FATE MOVIES 2.2 — blockproof static catalog + StormOS player
   Catalog+posters ship WITH the site (fate-movies-cat.js + sheets).
   Servers: the exact StormOS Cinema lineup (TMDB-id embeds) in their
   auto-fallback order, plus 12s no-signal auto-switch like StormOS.
   ================================================================ */
var $ = function(id){ return document.getElementById(id); };

var LS = {
  HIST: 'fate_movies_history',
  SE: 'fate_movies_se',
  PANIC: 'fate_v5_panic',
  SBASE: 'fate_movies_sbase'
};

/* CDN chain — mirrors of the storage repo (same ladder browser.html uses).
   '' = relative: sheets uploaded next to this page ride the site host. */
var SHEET_BASES = [
  'msheets/',
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/msheets/',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/msheets/',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/msheets/',
  'https://testingcf.jsdelivr.net/gh/TongSherbet/storage@main/msheets/',
  'https://quantil.jsdelivr.net/gh/TongSherbet/storage@main/msheets/',
  'https://cdn.statically.io/gh/TongSherbet/storage/main/msheets/',
  'https://raw.githack.com/TongSherbet/storage/main/msheets/'
];
var CAT_SCRIPTS = [
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/fate-movies-cat.js',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/fate-movies-cat.js',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/fate-movies-cat.js',
  'https://testingcf.jsdelivr.net/gh/TongSherbet/storage@main/fate-movies-cat.js',
  'https://quantil.jsdelivr.net/gh/TongSherbet/storage@main/fate-movies-cat.js'
];

/* Baked-in picks: only used if BOTH the local catalog file and every
   mirror are gone (someone deleted everything) — still playable. */
var FALLBACK = [
  {imdb_id:'tt0468569',name:'The Dark Knight',type:'movie',year:'2008',imdbRating:'9.0'},
  {imdb_id:'tt1375666',name:'Inception',type:'movie',year:'2010',imdbRating:'8.8'},
  {imdb_id:'tt0816692',name:'Interstellar',type:'movie',year:'2014',imdbRating:'8.7'},
  {imdb_id:'tt1160419',name:'Dune',type:'movie',year:'2021',imdbRating:'8.0'},
  {imdb_id:'tt10872600',name:'Spider-Man: No Way Home',type:'movie',year:'2021',imdbRating:'8.2'},
  {imdb_id:'tt1745960',name:'Top Gun: Maverick',type:'movie',year:'2022',imdbRating:'8.2'},
  {imdb_id:'tt7286454',name:'Joker',type:'movie',year:'2019',imdbRating:'8.4'},
  {imdb_id:'tt15398776',name:'Oppenheimer',type:'movie',year:'2023',imdbRating:'8.3'},
  {imdb_id:'tt4154796',name:'Avengers: Endgame',type:'movie',year:'2019',imdbRating:'8.4'},
  {imdb_id:'tt6263850',name:'Deadpool & Wolverine',type:'movie',year:'2024',imdbRating:'7.6'},
  {imdb_id:'tt0111161',name:'The Shawshank Redemption',type:'movie',year:'1994',imdbRating:'9.3'},
  {imdb_id:'tt0110912',name:'Pulp Fiction',type:'movie',year:'1994',imdbRating:'8.9'},
  {imdb_id:'tt0903747',name:'Breaking Bad',type:'series',year:'2008',imdbRating:'9.5'},
  {imdb_id:'tt0944947',name:'Game of Thrones',type:'series',year:'2011',imdbRating:'9.2'},
  {imdb_id:'tt4574334',name:'Stranger Things',type:'series',year:'2016',imdbRating:'8.7'},
  {imdb_id:'tt0386676',name:'The Office',type:'series',year:'2005',imdbRating:'9.0'},
  {imdb_id:'tt0108778',name:'Friends',type:'series',year:'1994',imdbRating:'8.9'},
  {imdb_id:'tt3032476',name:'Better Call Saul',type:'series',year:'2015',imdbRating:'9.0'},
  {imdb_id:'tt3581920',name:'The Last of Us',type:'series',year:'2023',imdbRating:'8.7'},
  {imdb_id:'tt13443470',name:'Wednesday',type:'series',year:'2022',imdbRating:'8.1'},
  {imdb_id:'tt10919420',name:'Squid Game',type:'series',year:'2021',imdbRating:'8.0'},
  {imdb_id:'tt1190634',name:'The Boys',type:'series',year:'2019',imdbRating:'8.7'},
  {imdb_id:'tt11126994',name:'Arcane',type:'series',year:'2021',imdbRating:'9.0'},
  {imdb_id:'tt2861424',name:'Rick and Morty',type:'series',year:'2013',imdbRating:'9.1'}
];

/* ---------- providers ----------
   StormOS Cinema's server lineup, same sources, same fallback order
   (SERVER_ORDER, deduped, anime-only handlers skipped). tmdb:1 means
   the URL takes the TMDB id; items missing a TMDB id only offer the
   IMDb-based server. */
function P(id, name, tmdb, build){ return { id: id, name: name, tmdb: tmdb, build: build }; }
var PROVIDERS = [
  P('vidlink', 'Vidlink', 1, function(t,id,s,e){ return t==='series' ? 'https://vidlink.pro/tv/'+id+'/'+s+'/'+e+'?primaryColor=f59e0b&secondaryColor=a8a8a8&iconColor=f59e0b&icons=default' : 'https://vidlink.pro/movie/'+id+'?primaryColor=f59e0b&secondaryColor=a8a8a8&iconColor=f59e0b&icons=default'; }),
  P('videasy', 'Videasy', 1, function(t,id,s,e){ return t==='series' ? 'https://player.videasy.to/tv/'+id+'/'+s+'/'+e+'?nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true&color=f59e0b' : 'https://player.videasy.to/movie/'+id+'?color=f59e0b&overlay=true'; }),
  P('vidcore', 'VidCore', 1, function(t,id,s,e){ return t==='series' ? 'https://vidcore.org/embed/tv/'+id+'/'+s+'/'+e : 'https://vidcore.org/embed/movie/'+id; }),
  P('autoembed', 'AutoEmbed', 1, function(t,id,s,e){ return t==='series' ? 'https://autoembed.app/tv/tmdb/'+id+'-'+s+'-'+e : 'https://autoembed.app/movie/tmdb/'+id; }),
  P('moviesapi', 'MoviesAPI', 1, function(t,id,s,e){ return t==='series' ? 'https://moviesapi.to/tv/'+id+'/'+s+'/'+e : 'https://moviesapi.to/movie/'+id; }),
  P('vidsrc', 'Vidsrc.pm', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.pm/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.pm/embed/movie/'+id; }),
  P('phantom', 'Phantom', 1, function(t,id,s,e){ return t==='series' ? 'https://vidphantom.com/tv/'+id+'/'+s+'/'+e : 'https://vidphantom.com/movie/'+id; }),
  P('cinesrc', 'Cinesrc', 1, function(t,id,s,e){ return t==='series' ? 'https://www.cinesrc.st/embed/tv/'+id+'?s='+s+'&e='+e : 'https://www.cinesrc.st/embed/movie/'+id; }),
  P('vidsrcsbs', 'Vidsrc.sbs', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.sbs/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.sbs/embed/movie/'+id; }),
  P('twoembedcc', '2embed', 1, function(t,id,s,e){ return t==='series' ? 'https://www.2embed.cc/embed/tv/'+id+'/'+s+'/'+e : 'https://www.2embed.cc/embed/movie/'+id; }),
  P('smashy', 'SmashyStream', 1, function(t,id,s,e){ return t==='series' ? 'https://yapgrid.com/embed/tv/'+id+'/'+s+'/'+e : 'https://yapgrid.com/embed/movie/'+id; }),
  P('vidfast', 'VidFast', 1, function(t,id,s,e){ return t==='series' ? 'https://embedflix.net/tv/'+id+'/'+s+'/'+e : 'https://embedflix.net/movie/'+id; }),
  P('embedsu', 'Vidsrc.to', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.to/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.to/embed/movie/'+id; }),
  P('vidspark', 'Vidspark', 1, function(t,id,s,e){ return t==='series' ? 'https://vidspark.to/tv/'+id+'/'+s+'/'+e : 'https://vidspark.to/movie/'+id; }),
  P('vidrock', 'Vidrock', 1, function(t,id,s,e){ return t==='series' ? 'https://vidrock.ru/tv/'+id+'/'+s+'/'+e : 'https://vidrock.ru/movie/'+id; }),
  P('vidflix', 'Vidflix', 1, function(t,id,s,e){ return t==='series' ? 'https://vidflix.club/tv/'+id+'/'+s+'/'+e : 'https://vidflix.club/movie/'+id; }),
  P('vidlux', 'Vidlux', 1, function(t,id,s,e){ return t==='series' ? 'https://vidlux.xyz/embed/tv/'+id+'/'+s+'/'+e : 'https://vidlux.xyz/embed/movie/'+id; }),
  P('vidsrcme', 'Vidsrc.me', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrcme.ru/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrcme.ru/embed/movie/'+id; }),
  P('vidsrcin', 'Vidsrc.in', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.in/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.in/embed/movie/'+id; }),
  P('vidsrcio', 'Vidsrc.io', 1, function(t,id,s,e){ return t==='series' ? 'https://vidsrc.io/embed/tv/'+id+'/'+s+'/'+e : 'https://vidsrc.io/embed/movie/'+id; }),
  P('vsembed', 'VSEmbed', 1, function(t,id,s,e){ return t==='series' ? 'https://vsembed.ru/embed/tv/'+id+'/'+s+'/'+e : 'https://vsembed.ru/embed/movie/'+id; }),
  P('embedsu2', 'Embed.su', 1, function(t,id,s,e){ return t==='series' ? 'https://www.embed.su/embed/tv/'+id+'/'+s+'/'+e : 'https://www.embed.su/embed/movie/'+id; }),
  P('vidfastvc', 'Vidfast.vc', 1, function(t,id,s,e){ return t==='series' ? 'https://vidfast.vc/tv/'+id+'/'+s+'/'+e : 'https://vidfast.vc/movie/'+id; }),
  P('wfslol', 'WFS', 1, function(t,id,s,e){ return t==='series' ? 'https://wfs.lol/embed/tv/'+id+'/'+s+'/'+e : 'https://wfs.lol/embed/movie/'+id; }),
  P('vidsrctop', 'Vid-src.top', 1, function(t,id,s,e){ return t==='series' ? 'https://vid-src.top/embed/tv/'+id+'/'+s+'/'+e : 'https://vid-src.top/embed/movie/'+id; }),
  P('toustream', 'TouStream', 1, function(t,id,s,e){ return t==='series' ? 'https://toustream.xyz/tv/'+id+'/'+s+'/'+e : 'https://toustream.xyz/movie/'+id; }),
  P('vidlinkimdb', 'Vidlink IMDb', 0, function(t,id,s,e){ return t==='series' ? 'https://vidlink.pro/tv/'+id+'/'+s+'/'+e : 'https://vidlink.pro/movie/'+id; })
];
var provIdx = 10, usable = PROVIDERS; /* StormOS starts on YapGrid = SmashyStream */

/* 12s no-signal auto-switch — port of StormOS's armAutoFallback watchdog:
   only messages from THIS embed count, the window restarts on iframe load,
   and the chain stops after coming full circle. */
var fbTimer = null, fbLoaded = false, fbStart = null, fbMsgHandler = null;
var AUTO_FB_MS = 12000;
function fbDisarm(){ if (fbTimer){ clearTimeout(fbTimer); fbTimer = null; } }
function fbClear(){
  fbDisarm();
  if (fbMsgHandler){ window.removeEventListener('message', fbMsgHandler); fbMsgHandler = null; }
  fbLoaded = false; fbStart = null;
}
function fbAdvance(){
  fbDisarm();
  if (fbStart == null || !currentMeta) return;
  var next = (provIdx + 1) % usable.length;
  if (next === fbStart){ fbStart = null; return; } /* full circle — give up quietly */
  toast('\u201C' + usable[provIdx].name + '\u201D didn\u2019t load \u2014 trying ' + usable[next].name + '\u2026');
  provIdx = next;
  renderProviders();
  loadFrame();
}

/* ---------- state ---------- */
var kind = 'movie', cat = 'top', genre = 'All', mode = 'browse';
var skip = 0, done = false, currentMeta = null, currentSE = {s:1,e:1}, view = [];
var searchSeq = 0, booted = false;
var CAT = null, BYID = {}, MOV = [], SER = [];

/* ---------- helpers ---------- */
function toast(msg){
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm); t._tm = setTimeout(function(){ t.classList.remove('show'); }, 2600);
}
function setSource(state, text){
  var c = $('sourceChip');
  if (state === 'ok') c.classList.remove('blocked'); else c.classList.add('blocked');
  $('sourceLabel').textContent = text;
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* ---------- sprite engine (posters live in 10x10 grids) ---------- */
var sheetLoaded = {}, sheetLoading = {}, sheetCells = {}, sheetBase = -1, sheetProbed = false, pendingSheets = [];
function slotOf(x){
  var sheet = Math.floor(x / 100), slot = x % 100;
  var c = slot % 10, r = Math.floor(slot / 10);
  return { sheet: sheet, pos: (c * 100 / 9) + '% ' + (r * 100 / 9) + '%' };
}
function sheetURL(s){
  var base = (sheetBase > 0) ? SHEET_BASES[sheetBase] : SHEET_BASES[0];
  return base + 'sheet-' + s + '.jpg';
}
function probeBase(i){
  if (i >= SHEET_BASES.length){ sheetBase = -2; sheetProbed = true; flushPending(); return; }
  var im = new Image();
  im.onload = function(){
    sheetBase = i; sheetProbed = true;
    try { localStorage.setItem(LS.SBASE, String(i)); } catch(e){}
    flushPending();
  };
  im.onerror = function(){ setTimeout(function(){ probeBase(i + 1); }, 0); };
  im.src = SHEET_BASES[i] + 'sheet-0.jpg';
}
function flushPending(){
  var p = pendingSheets; pendingSheets = [];
  p.forEach(function(s){ loadSheet(s); });
}
function loadSheet(s){
  if (sheetLoaded[s]) return;
  if (sheetLoading[s]) return;
  if (!sheetProbed){ if (pendingSheets.indexOf(s) < 0) pendingSheets.push(s); return; }
  if (sheetBase === -2){ failCells(s); return; }
  sheetLoading[s] = 1;
  var im = new Image();
  im.onload = function(){ sheetLoaded[s] = 1; delete sheetLoading[s]; paintCells(s); };
  im.onerror = function(){ delete sheetLoading[s]; failCells(s); };
  im.src = sheetURL(s);
}
function paintCells(s){
  var els = sheetCells[s] || [];
  for (var i = 0; i < els.length; i++){
    if (!els[i]._dead){
      els[i].style.backgroundImage = 'url("' + sheetURL(s) + '")';
      els[i].style.backgroundPosition = els[i]._pos;
      els[i].classList.remove('noimg');
    }
  }
  delete sheetCells[s];
}
function failCells(s){
  var els = sheetCells[s] || [];
  for (var i = 0; i < els.length; i++){
    if (!els[i]._dead) els[i].classList.add('noimg');
  }
  delete sheetCells[s];
}
function paintSprite(el, x){
  if (x == null || x < 0){ el.classList.add('noimg'); return; }
  var sl = slotOf(x);
  el._pos = sl.pos;
  var arr = sheetCells[sl.sheet] || (sheetCells[sl.sheet] = []);
  arr.push(el);
  if (sheetLoaded[sl.sheet]){
    el.style.backgroundImage = 'url("' + sheetURL(sl.sheet) + '")';
    el.style.backgroundPosition = sl.pos;
    el.classList.remove('noimg');
  } else {
    el.classList.add('noimg');
    loadSheet(sl.sheet);
  }
}
function initSheetProbe(){
  try {
    var v = parseInt(localStorage.getItem(LS.SBASE) || '-1', 10);
    if (v >= 0 && v < SHEET_BASES.length){ sheetBase = v; sheetProbed = true; flushPending(); return; }
  } catch(e){}
  probeBase(0);
}

/* ---------- cards / grid ---------- */
function cardHTML(m){
  var type = m.t === 's' ? 'series' : 'movie';
  var rating = m.r ? '<span class="badge"><svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' + esc(m.r) + '</span>' : '';
  var typeb = '<span class="badge typeb">' + (type === 'series' ? 'Series' : 'Movie') + '</span>';
  var sub = esc(m.y || '') + (type === 'series' ? ' · Series' : '');
  return '<div class="mcard" onclick="openDetail(\'' + esc(m.i) + '\',\'' + type + '\')">' +
    '<div class="poster">' + typeb + '<div class="mp"></div><div class="ph" data-l="' + esc((m.n || '?').charAt(0).toUpperCase()) + '"></div>' + rating + '</div>' +
    '<div class="mname">' + esc(m.n) + '</div><div class="msub">' + sub + '</div></div>';
}
function renderBatch(arr, from, to){
  var html = '';
  for (var i = from; i < to && i < arr.length; i++) html += cardHTML(arr[i]);
  $('grid').insertAdjacentHTML('beforeend', html);
  // wire sprite targets onto the freshly inserted nodes
  var nodes = $('grid').querySelectorAll('.mcard');
  var base = nodes.length - Math.min(to, arr.length) + from;
  for (var j = from; j < to && j < arr.length; j++){
    var card = nodes[base + (j - from)];
    if (!card) continue;
    var mp = card.querySelector('.mp');
    if (mp) paintSprite(mp, arr[j].x);
  }
}
function clearGrid(){ $('grid').innerHTML = ''; }
function setState(html){
  var b = $('stateBox');
  if (!html){ b.style.display = 'none'; b.innerHTML = ''; return; }
  b.style.display = 'block'; b.innerHTML = html;
}

/* ---------- browse (all local, instant) ---------- */
function rebuildView(){
  var arr = (kind === 'movie') ? MOV : SER;
  if (genre && genre !== 'All'){
    arr = arr.filter(function(m){ return m.g && m.g.indexOf(genre) > -1; });
  }
  if (cat === 'imdbRating'){
    arr = arr.slice().sort(function(a, b){ return (b.r || 0) - (a.r || 0); });
  } else if (cat === 'year'){
    arr = arr.slice().sort(function(a, b){ return (b.y || 0) - (a.y || 0); });
  }
  view = arr;
}
function loadPage(){
  if (done || mode !== 'browse') return;
  if (skip >= view.length){ done = true; return; }
  var next = skip + 60;
  renderBatch(view, skip, next);
  skip = next;
  if (skip >= view.length) done = true;
}
function backToBrowse(){
  mode = 'browse'; done = false; skip = 0;
  setState('');
  clearGrid();
  rebuildView();
  loadPage();
}

/* ---------- search (local, instant) ---------- */
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
    setState('<div class="big">🍿</div>Nothing found for “' + esc(q) + '”<br><span style="font-size:.8rem">The on-device catalog holds ' + (MOV.length + SER.length) + ' titles — try a shorter query.</span>');
    return;
  }
  setState('');
  clearGrid();
  renderBatch(res, 0, Math.min(res.length, 120));
}

/* ---------- details (synchronous — data is local) ---------- */
function fillSprite(el, m){
  if (!el) return;
  el.classList.remove('noimg');
  el.style.backgroundImage = 'none';
  if (m && m.x >= 0) paintSprite(el, m.x); else el.classList.add('noimg');
}
function openDetail(id, type){
  var m = BYID[id];
  if (!m){
    m = { i: id, t: type === 'series' ? 's' : 'm', n: 'Unknown title', x: -1 };
  }
  currentMeta = m;
  $('detailOverlay').classList.add('open');
  $('dName').textContent = m.n;
  var chips = '';
  if (m.y) chips += '<span class="d-chip">' + esc(m.y) + '</span>';
  if (m.r) chips += '<span class="d-chip gold"><svg viewBox="0 0 24 24"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' + esc(m.r) + '</span>';
  if (m.ru) chips += '<span class="d-chip">' + esc(m.ru) + '</span>';
  (m.g || []).forEach(function(g){ chips += '<span class="d-chip">' + esc(g) + '</span>'; });
  $('dMeta').innerHTML = chips;
  $('dDesc').textContent = m.d || 'No description on file — hit play anyway, the stream does not need it.';
  $('dCast').innerHTML = (m.c && m.c.length) ? '<b>Cast:</b> ' + esc(m.c.join(', ')) : '';
  var poster = $('dPoster');
  poster.classList.remove('noimg');
  fillSprite(poster, m);
  if (m.x >= 0){
    var sl = slotOf(m.x);
    var bg = $('dBg');
    bg.style.backgroundImage = 'url("' + sheetURL(sl.sheet) + '")';
    bg.style.backgroundPosition = sl.pos;
    bg.style.backgroundSize = '1000% 1000%';
    bg.style.filter = 'blur(26px) brightness(0.38) saturate(1.25)';
    bg.style.transform = 'scale(1.35)';
  } else {
    $('dBg').style.backgroundImage = 'none';
  }
  var label = 'Play now';
  if (m.t === 's'){
    var tot = 0;
    if (m.sp) m.sp.split(',').forEach(function(p){ tot += parseInt(p.split(':')[1], 10) || 0; });
    if (tot) label = 'Play · ' + tot + ' episodes';
  }
  $('dPlayLabel').textContent = label;
}
function closeDetail(){ $('detailOverlay').classList.remove('open'); }

/* ---------- player ---------- */
function seOf(id){
  try { return JSON.parse(localStorage.getItem(LS.SE) || '{}')[id] || null; } catch(e){ return null; }
}
function saveSE(id, s, e){
  try {
    var all = JSON.parse(localStorage.getItem(LS.SE) || '{}');
    all[id] = { s: s, e: e };
    localStorage.setItem(LS.SE, JSON.stringify(all));
  } catch(err){}
}
function playCurrent(){
  if (!currentMeta) return;
  openPlayer(currentMeta);
}
function usableProviders(m){
  var out = [];
  for (var i = 0; i < PROVIDERS.length; i++)
    if (!PROVIDERS[i].tmdb || (m && m.tm)) out.push(PROVIDERS[i]);
  return out;
}
function openPlayer(m){
  var isSeries = m.t === 's';
  currentSE = seOf(m.i) || { s: 1, e: 1 };
  $('pTitle').textContent = m.n || 'Now playing';
  $('detailOverlay').classList.remove('open');
  $('playerOverlay').classList.add('open');
  $('seTools').style.display = isSeries ? 'flex' : 'none';
  if (isSeries) buildSEPickers(m);
  usable = usableProviders(m);
  if (provIdx >= usable.length) provIdx = 0;
  renderProviders();
  loadFrame();
  pushHistory(m, isSeries ? currentSE.s : null, isSeries ? currentSE.e : null);
}
function buildSEPickers(m){
  var seasons = [];
  if (m.sp){
    m.sp.split(',').forEach(function(p){
      var a = p.split(':');
      var s = parseInt(a[0], 10), e = parseInt(a[1], 10);
      if (s >= 1 && e >= 1) seasons.push([s, e]);
    });
    seasons.sort(function(a, b){ return a[0] - b[0]; });
  }
  if (!seasons.length) seasons = [[1, 1]];
  var selS = $('selS'), selE = $('selE');
  selS.innerHTML = seasons.map(function(x){ return '<option value="' + x[0] + '">Season ' + x[0] + '</option>'; }).join('');
  var has = false;
  for (var i = 0; i < seasons.length; i++) if (seasons[i][0] === currentSE.s) has = true;
  if (!has) currentSE.s = seasons[0][0];
  selS.value = String(currentSE.s);
  fillE(seasons);
  if (selE.value !== String(currentSE.e)) currentSE.e = parseInt(selE.options[0].value, 10) || 1;
  selE.value = String(currentSE.e);
  selS.onchange = function(){
    currentSE.s = parseInt(selS.value, 10) || 1;
    fillE(seasons);
    currentSE.e = parseInt($('selE').value, 10) || 1;
    saveSE(m.i, currentSE.s, currentSE.e);
    loadFrame();
  };
  selE.onchange = function(){
    currentSE.e = parseInt(selE.value, 10) || 1;
    saveSE(m.i, currentSE.s, currentSE.e);
    loadFrame();
  };
}
function fillE(seasons){
  var selE = $('selE');
  var count = 1;
  for (var i = 0; i < seasons.length; i++) if (seasons[i][0] === currentSE.s) count = seasons[i][1];
  var html = '';
  for (var e = 1; e <= count; e++) html += '<option value="' + e + '">Episode ' + e + '</option>';
  selE.innerHTML = html;
}
function renderProviders(){
  $('provChips').innerHTML = usable.map(function(p, i){
    return '<button class="prov' + (i === provIdx ? ' active' : '') + '" onclick="setProvider(' + i + ')"><span class="pd"></span>' + esc(p.name) + '</button>';
  }).join('');
}
function setProvider(i){ fbStart = null; provIdx = i; renderProviders(); loadFrame(); }
function loadFrame(){
  if (!currentMeta) return;
  var type = currentMeta.t === 's' ? 'series' : 'movie';
  var p = usable[provIdx];
  if (!p) return;
  var id = p.tmdb ? (currentMeta.tm || currentMeta.i) : currentMeta.i;
  var url = p.build(type, id, currentSE.s || 1, currentSE.e || 1);
  var f = $('pFrame');
  $('pLoad').style.display = 'flex';
  f.style.display = 'none';
  /* --- StormOS watchdog arm --- */
  fbDisarm();
  if (fbMsgHandler){ window.removeEventListener('message', fbMsgHandler); fbMsgHandler = null; }
  if (fbStart == null) fbStart = provIdx;
  fbLoaded = false;
  fbMsgHandler = function(e){
    if (!e || !e.source || e.source !== f.contentWindow) return; /* only THIS embed counts */
    if (fbLoaded) fbDisarm(); /* embed is alive — cancel fallback */
  };
  window.addEventListener('message', fbMsgHandler);
  f.onload = function(){
    $('pLoad').style.display = 'none';
    f.style.display = 'block';
    fbLoaded = true;
    fbDisarm(); /* restart the window: embed has 12s after load to show life */
    fbTimer = setTimeout(fbAdvance, AUTO_FB_MS);
  };
  f.onerror = function(){ if (!fbLoaded) fbAdvance(); };
  f.src = url;
  setTimeout(function(){
    if (f.getAttribute('src') === url && f.style.display === 'none'){
      $('pLoad').style.display = 'none';
      f.style.display = 'block';
    }
  }, 4000);
  fbTimer = setTimeout(fbAdvance, AUTO_FB_MS); /* never even loaded -> hop */
}
function closePlayer(){
  fbClear();
  var f = $('pFrame'); f.src = 'about:blank'; f.style.display = 'none';
  $('playerOverlay').classList.remove('open');
}

/* ---------- history ---------- */
function pushHistory(m, s, e){
  try {
    var h = JSON.parse(localStorage.getItem(LS.HIST) || '[]');
    h = h.filter(function(x){ return x.id !== m.i; });
    h.unshift({ id: m.i, name: m.n, type: m.t === 's' ? 'series' : 'movie', year: m.y || '', s: s || null, e: e || null, ts: Date.now() });
    localStorage.setItem(LS.HIST, JSON.stringify(h.slice(0, 12)));
    renderHistory();
  } catch(err){}
}
function renderHistory(){
  var h = [];
  try { h = JSON.parse(localStorage.getItem(LS.HIST) || '[]'); } catch(e){}
  var wrap = $('histWrap');
  if (!h.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  $('histRow').innerHTML = h.map(function(x){
    var ep = (x.type === 'series' && x.s) ? 'S' + x.s + (x.e ? ' · E' + x.e : '') : (x.type === 'series' ? 'Series' : 'Movie');
    return '<div class="hist-card" onclick="resumeItem(\'' + esc(x.id) + '\',\'' + x.type + '\')">' +
      '<div class="hc-poster"><div class="mp"></div><div class="ph" data-l="' + esc((x.name || '?').charAt(0).toUpperCase()) + '"></div></div>' +
      '<div class="hc-name">' + esc(x.name) + '</div><div class="hc-ep">' + esc(ep) + '</div></div>';
  }).join('');
  var cards = $('histRow').querySelectorAll('.hist-card');
  for (var i = 0; i < cards.length && i < h.length; i++){
    var mp = cards[i].querySelector('.mp');
    var it = BYID[h[i].id];
    if (mp) paintSprite(mp, it ? it.x : -1);
  }
}
function resumeItem(id, type){
  openDetail(id, type);
  playCurrent();
}
function clearHistory(){
  try { localStorage.removeItem(LS.HIST); } catch(e){}
  renderHistory();
  toast('Continue Watching cleared');
}

/* ---------- controls ---------- */
function setKind(k){
  kind = k;
  var btns = document.querySelectorAll('.type-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('active', btns[i].getAttribute('data-kind') === k);
  genre = 'All';
  renderGenrePills();
  backToBrowse();
}
function setCat(c, el){
  cat = c;
  var pills = $('catPills').children;
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  if (el) el.classList.add('active');
  backToBrowse();
}
function setGenre(g, el){
  genre = g;
  var pills = $('genrePills').children;
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  if (el) el.classList.add('active');
  backToBrowse();
}
function renderGenrePills(){
  var list = (kind === 'movie') ? (CAT ? CAT.gm : []) : (CAT ? CAT.gs : []);
  $('genrePills').innerHTML = list.map(function(g){
    return '<button class="pill' + (g === genre ? ' active' : '') + '" data-g="' + esc(g) + '" onclick="setGenre(\'' + esc(g).replace(/'/g, "\\'") + '\',this)">' + esc(g) + '</button>';
  }).join('');
}
function toggleFab(){
  $('fabMenu').classList.toggle('open');
  $('fabBackdrop').classList.toggle('open');
}
function triggerPanic(){
  window.location.href = 'https://clever.com';
}
function retryCatalog(){
  location.reload();
}

/* ---------- particles (theme-aware) ---------- */
var canvas, ctx, particles = [], mouseX = 0, mouseY = 0, pColor = '245,158,11';
function resizeCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
function readPColor(){
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--primary-rgb').trim();
    if (v) pColor = v;
  } catch(e){}
}
function Particle(){
  this.x = Math.random() * canvas.width;
  this.y = Math.random() * canvas.height;
  this.vx = (Math.random() - .5) * 0.4;
  this.vy = (Math.random() - .5) * 0.4;
  this.size = Math.random() * 2 + 0.5;
  this.opacity = Math.random() * 0.4 + 0.1;
}
Particle.prototype.update = function(){
  this.x += this.vx; this.y += this.vy;
  var dx = mouseX - this.x, dy = mouseY - this.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 150){ this.vx -= dx * 0.0003; this.vy -= dy * 0.0003; }
  if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
  if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
};
Particle.prototype.draw = function(){
  ctx.beginPath();
  ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(' + pColor + ',' + this.opacity + ')';
  ctx.fill();
};
function animateParticles(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (var i = 0; i < particles.length; i++){
    for (var j = i + 1; j < particles.length; j++){
      var dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120){
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = 'rgba(' + pColor + ',' + (0.08 * (1 - dist / 120)) + ')';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
  particles.forEach(function(p){ p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}
function initParticles(){
  canvas = $('particleCanvas'); ctx = canvas.getContext('2d');
  readPColor();
  document.addEventListener('fate-themechange', readPColor);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  for (var i = 0; i < 50; i++) particles.push(new Particle());
  animateParticles();
}
function initMouseGlow(){
  var glow = $('mouseGlow');
  document.addEventListener('mousemove', function(e){
    mouseX = e.clientX; mouseY = e.clientY;
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
    glow.style.opacity = '1';
  });
  document.addEventListener('mouseleave', function(){ glow.style.opacity = '0'; });
}

/* ---------- panic + escape ---------- */
function initPanic(){
  document.addEventListener('keydown', function(e){
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'){
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    var panic = null;
    try { panic = localStorage.getItem(LS.PANIC); } catch(err){}
    if (panic && e.key.toLowerCase() === panic.toLowerCase()) triggerPanic();
    if (e.key === 'Escape'){ closePlayer(); closeDetail(); }
  });
}

/* ---------- search input ---------- */
var searchTimer = null;
function initSearch(){
  $('searchInput').addEventListener('input', function(){
    var q = this.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2){
      if (mode === 'search') backToBrowse();
      return;
    }
    searchTimer = setTimeout(function(){ doSearch(q); }, 350);
  });
}

/* ---------- infinite scroll ---------- */
function initObserver(){
  if (!('IntersectionObserver' in window)){
    window.addEventListener('scroll', function(){
      if (window.innerHeight + window.scrollY > document.body.offsetHeight - 600) loadPage();
    });
    return;
  }
  new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadPage();
  }, { rootMargin: '700px' }).observe($('sentinel'));
}

/* ---------- catalog boot ---------- */
function decodeCat(cb){
  try {
    if (typeof DecompressionStream === 'undefined') throw new Error('old browser');
    var b64 = window.FATE_MOVIES_B64;
    if (!b64 || !b64.length) throw new Error('empty');
    var bin = atob(b64), n = bin.length, bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json()
      .then(function(d){ CAT = d; cb(true); })
      .catch(function(){ cb(false); });
  } catch(e){ cb(false); }
}
function fallbackPicks(){
  var map = function(b){
    var r = parseFloat(b.imdbRating) || null;
    var y = parseInt(b.year, 10) || null;
    return { i: b.imdb_id, n: b.name, t: b.type === 'series' ? 's' : 'm', y: y, r: r, x: -1 };
  };
  MOV = FALLBACK.filter(function(b){ return b.type === 'movie'; }).map(map);
  SER = FALLBACK.filter(function(b){ return b.type === 'series'; }).map(map);
  BYID = {};
  MOV.concat(SER).forEach(function(m){ BYID[m.i] = m; });
}
function buildDicts(){
  MOV = CAT.m || []; SER = CAT.s || [];
  BYID = {};
  MOV.concat(SER).forEach(function(m){ BYID[m.i] = m; });
}
function afterCatalog(ok){
  booted = true;
  if (ok){
    buildDicts();
    setSource('ok', 'Catalog: on-device · ' + (MOV.length + SER.length) + ' titles');
  } else {
    fallbackPicks();
    setSource('down', 'Catalog file missing — offline picks');
  }
  try { renderGenrePills(); } catch(e){}
  try { renderHistory(); } catch(e){}
  try { rebuildView(); } catch(e){}
  try { initObserver(); } catch(e){}
  try { loadPage(); } catch(e){ fallbackPicks(); rebuildView(); loadPage(); }
}
/* CDN chain for the catalog file — only entered if the local script tag 404s */
var catChainStarted = false;
window.__catCDN = function(){
  if (catChainStarted || booted) return;
  catChainStarted = true;
  var step = function(i){
    if (i >= CAT_SCRIPTS.length || booted) return;
    var s = document.createElement('script');
    s.src = CAT_SCRIPTS[i];
    s.onload = function(){ if (!booted) decodeCat(afterCatalog); };
    s.onerror = function(){ step(i + 1); };
    document.head.appendChild(s);
  };
  step(0);
};

/* ---------- boot (every step guarded) ---------- */
document.addEventListener('DOMContentLoaded', function(){
  try { initParticles(); } catch(e){}
  try { initMouseGlow(); } catch(e){}
  try { initPanic(); } catch(e){}
  try { initSearch(); } catch(e){}
  try { initSheetProbe(); } catch(e){}
  if (window.FATE_MOVIES_B64){
    decodeCat(afterCatalog);
  } else {
    window.__catCDN();
  }
});
