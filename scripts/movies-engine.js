/* ===== FATE MOVIES ENGINE (dedicated movies page — no games, jet only) ===== */
console.log('%c[FATE MOVIES] engine loaded', 'color:#a78bfa;font-weight:bold;');

function fmGet(id){ return document.getElementById(id); }
function fmToast(msg){
  try {
    let t = document.getElementById('fmToast');
    if (!t){ t = document.createElement('div'); t.id = 'fmToast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:2147483000;background:rgba(12,10,9,.95);border:1px solid rgba(245,158,11,.5);color:#fcd34d;font:600 13px/1.4 system-ui,sans-serif;padding:.6rem 1rem;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;transition:opacity .25s;opacity:0;pointer-events:none;';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(fmToast._t); fmToast._t = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  } catch(e){}
}

/* ---------- video engine status (hls.js + artplayer load in <head>) ---------- */
function fmEngineOk(){ return typeof Artplayer !== 'undefined' && typeof Hls !== 'undefined'; }
function fmEnsureEngine(){
  return new Promise(async function(resolve){
    if (fmEngineOk()) return resolve(true);
    if (window.fateTVLibs === 'failed') return resolve(false);
    if (window.fateTVLibsReady){
      try { await Promise.race([window.fateTVLibsReady, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 10000))]); } catch(e){}
    } else { await new Promise(r => setTimeout(r, 3000)); }
    resolve(fmEngineOk());
  });
}

/* ---------- stream sites (open through the jet tunnel) ---------- */
const FM_SITES = [
  { label: 'Aether', url: 'https://aether.ist/', desc: 'Movies & TV — the reference site\u2019s pick', hero: true, color: '#a78bfa',
    icon: '<path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>' },
  { label: 'Tubi', url: 'https://tubitv.com/', desc: 'Free movies & TV', color: '#ff7a59',
    icon: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-2 14V8l6 4-6 4z"/>' },
  { label: 'Archive', url: 'https://archive.org/details/movies', desc: 'Public-domain classics', color: '#fbbf24',
    icon: '<path d="M3 3h18v4H3V3zm1 6h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9zm5 2v2h6v-2H9z"/>' },
  { label: 'YouTube', url: 'https://www.youtube.com/feed/storefront', desc: 'Free movies pane', color: '#ff0000',
    icon: '<path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81zM10 15V9l5.2 3z"/>' }
];
function fmBuildSites(){
  const grid = fmGet('fmSiteGrid'); if (!grid) return;
  grid.innerHTML = '';
  FM_SITES.forEach(s => {
    const d = document.createElement('div');
    d.className = 'site-card' + (s.hero ? ' hero' : '');
    d.innerHTML = '<span class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="' + s.color + '">' + s.icon + '</svg></span>' +
      '<span class="lbl">' + s.label + '</span><span class="desc">' + s.desc + '</span>' +
      '<span class="via">via wisp tunnel</span>';
    d.onclick = () => { try { fateBrowseOpen(s.url); } catch(e){ fmToast('tunnel still booting — tap again in a moment'); } };
    grid.appendChild(d);
  });
}

/* ---------- vault: sources, fetch ladder (direct -> corsproxy -> jet tunnel) ---------- */
const FM_SOURCES = [
  { name: 'somestuff', label: 'Somestuff VOD', urls: ['https://somestuffserver.koyeb.app/api/m3u8list', 'https://corsproxy.io/?https://somestuffserver.koyeb.app/api/m3u8list'] },
  { name: 'freetv', label: 'Free-TV', urls: ['https://gcore.jsdelivr.net/gh/Free-TV/IPTV@master/playlist.m3u8', 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'] },
  { name: 'iptvorg', label: 'iptv-org', urls: ['https://iptv-org.github.io/iptv/index.m3u', 'https://testingcf.jsdelivr.net/gh/iptv-org/iptv@gh-pages/index.m3u'] },
  { name: 'local', label: 'tv/master.m3u', urls: ['tv/master.m3u', '/tv/master.m3u'] }
];
const FM_TIMEOUT = 9000;
function fmFetchText(url, ms){
  return new Promise(function(resolve, reject){
    const c = new AbortController();
    const t = setTimeout(() => { c.abort(); reject(new Error('timeout')); }, ms || FM_TIMEOUT);
    fetch(url, { signal: c.signal, cache: 'no-store' }).then(r => {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(resolve, e => { clearTimeout(t); reject(e); });
  });
}
async function fmFetchLadder(urls){
  const chain = (urls || []).slice();
  if (chain.length) chain.push('https://corsproxy.io/?' + chain[0]);
  for (const u of chain){
    try { return await fmFetchText(u); } catch(e){ console.warn('[FATE MOVIES] lane failed:', u, (e && e.message) || e); }
  }
  /* last lane: the jet tunnel — same-origin fetch the SW routes over wisp */
  try {
    if (typeof FATE_JET !== 'undefined' && FATE_JET && FATE_JET_STATE === 'ready' && typeof fateSJEncode === 'function' && urls && urls[0]){
      const p = fateSJEncode(urls[0]);
      if (p){
        const r = await fetch(p, { cache: 'no-store' });
        if (r.ok) return await r.text();
      }
    }
  } catch(e){ console.warn('[FATE MOVIES] jet tunnel lane failed:', (e && e.message) || e); }
  throw new Error('all lanes failed');
}

/* ---------- m3u parsing (port of FATE TV) ---------- */
function fmParseM3U(text){
  text = String(text).replace(/(http[^\s#]+)(#EXTINF)/g, '$1\n$2');
  const lines = text.split('\n'), out = [];
  for (let i = 0; i < lines.length; i++){
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')){
      const title = line.split(',').pop().trim();
      const logo = (line.match(/tvg-logo="(.*?)"/) || [])[1] || '';
      const country = (line.match(/tvg-country="(.*?)"/) || [])[1] || '';
      const group = (line.match(/group-title="(.*?)"/) || [])[1] || '';
      const stream = ((lines[i + 1] || '').trim().split('#')[0]);
      if (stream && stream.startsWith('http')) out.push({ title, logo, stream, country, group });
    }
  }
  return out;
}
function fmIsMovie(ch){ return /movie|film|cinema/i.test(ch.group || ''); }

/* ---------- vault state + render ---------- */
let fmAll = [], fmView = [], fmRendered = 0, fmQ = '';
const FM_PAGE = 60;
const fmAlive = {};
const FM_DEAD = new Set(); /* streams that failed before ever playing (this session) */
const FM_POSTER_PH = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="45"><rect fill="none" width="30" height="45"/></svg>');

function fmStats(){
  const alive = Object.keys(fmAlive).filter(k => fmAlive[k]).length;
  const srcs = FM_SOURCES.length;
  const eng = fmEngineOk() ? 'engine ok' : 'engine loading';
  return fmAll.length.toLocaleString() + ' movies \u00b7 sources ' + alive + '/' + srcs + ' \u00b7 ' + eng;
}
function fmPaintStats(){ const el = fmGet('fmVaultStats'); if (el) el.textContent = fmStats(); }

function fmApplyFilter(){
  const q = fmQ.trim().toLowerCase();
  fmView = !q ? fmAll : fmAll.filter(c => c.title.toLowerCase().includes(q));
  fmRendered = 0;
  const grid = fmGet('fmVaultGrid'); if (grid) grid.innerHTML = '';
  if (!fmView.length){
    if (grid) grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>' +
      (fmAll.length ? '<p>No movies match "' + fmQ.replace(/[<>&]/g, '') + '"</p>' : '<p>No movie streams found — every source is unreachable on this network.</p><p style="font-size:.78rem;color:#64748b;margin-top:.5rem">Jet tunnel lane kicks in automatically once the tunnel is ready.</p>') +
      '<button class="load-more-btn" style="margin-top:1.25rem" onclick="fmLoadVault()">Retry</button></div>';
  }
  fmRenderMore();
}
function fmRenderMore(){
  const grid = fmGet('fmVaultGrid'); if (!grid) return;
  const slice = fmView.slice(fmRendered, fmRendered + FM_PAGE);
  slice.forEach(ch => grid.appendChild(fmCard(ch)));
  fmRendered += slice.length;
  const btn = fmGet('fmMoreBtn');
  if (btn) btn.style.display = fmRendered < fmView.length ? 'inline-flex' : 'none';
  fmPaintStats();
}
function fmCard(ch){
  const d = document.createElement('div');
  d.className = 'vault-card';
  const letter = (ch.title || '?').trim().charAt(0).toUpperCase();
  d.innerHTML = '<div class="fm-poster"><span class="fm-letter">' + (/[A-Z0-9]/.test(letter) ? letter : '\u25b6') + '</span>' +
    (ch.logo ? '<img loading="lazy" src="' + ch.logo.replace(/"/g, '') + '" onerror="this.remove()">' : '') +
    '</div><div class="fm-name">' + ch.title.replace(/[<>&]/g, '') + '</div>' +
    (ch.group ? '<div class="fm-group">' + ch.group.replace(/[<>&]/g, '') + '</div>' : '');
  d.onclick = () => fmPlay(ch);
  return d;
}

async function fmLoadVault(){
  const grid = fmGet('fmVaultGrid');
  if (grid) grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="skeleton-img" style="width:44px;height:44px;border-radius:50%;margin:0 auto 1rem;animation:spin 1s linear infinite,shimmer 1.5s infinite"></div><p>Fetching movie sources\u2026</p></div>';
  fmPaintStats();
  const results = await Promise.allSettled(FM_SOURCES.map(async s => {
    const text = await fmFetchLadder(s.urls);
    fmAlive[s.name] = true;
    return { name: s.name, list: fmParseM3U(text) };
  }));
  const seen = new Set();
  fmAll = [];
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    r.value.list.forEach(ch => {
      if (!fmIsMovie(ch)) return;
      if (FM_DEAD.has(ch.stream)) return;
      const k = ch.stream;
      if (seen.has(k)) return;
      seen.add(k);
      fmAll.push(ch);
    });
  });
  /* longest titles last look messy — sort by group then title for a tidy wall */
  fmAll.sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.title.localeCompare(b.title));
  console.log('[FATE MOVIES] vault loaded:', fmAll.length, 'movies · sources', JSON.stringify(fmAlive));
  fmApplyFilter();
}

/* ---------- player (ArtPlayer + HLS, port of FATE TV engine) ---------- */
let fmArt = null, fmCur = null, fmEver = false, fmFailLock = false;
let fmWd = null, fmWdTick = null;

function fmIsNative(url){ return /\.(mp4|webm|ogg|mp3|m4a|mov)(\?|$)/i.test(url || ''); }

function fmShowStatus(txt, withActs){
  const el = fmGet('fmStatus'); if (!el) return;
  fmGet('fmStatusText').textContent = txt;
  fmGet('fmStatusActs').style.display = withActs === false ? 'none' : 'flex';
  el.classList.add('show');
}
function fmHideStatus(){ const el = fmGet('fmStatus'); if (el) el.classList.remove('show'); }
function fmStartWatchdog(sec){
  fmClearWatchdog();
  let left = sec || 25;
  fmWd = setTimeout(fmWatchdogFire, (sec || 25) * 1000);
  fmWdTick = setInterval(() => {
    left--;
    const t = fmGet('fmStatusText');
    if (t && left > 0 && !fmFailLock) t.textContent = 'Connecting to stream\u2026 ' + left + 's';
  }, 1000);
}
function fmClearWatchdog(){
  if (fmWd){ clearTimeout(fmWd); fmWd = null; }
  if (fmWdTick){ clearInterval(fmWdTick); fmWdTick = null; }
}
function fmWatchdogFire(){
  fmClearWatchdog();
  if (!fmGet('movieModal').classList.contains('open')) return;
  const v = fmArt && fmArt.video;
  if (v && v.readyState >= 2){
    if (v.paused){ fmShowStatus('Stream ready \u2014 tap \u25b6 to start', false); }
    else { fmHideStatus(); fmEver = true; }
    return;
  }
  fmFail('No response from stream');
}
function fmFail(reason){
  if (fmFailLock) return;
  if (!fmGet('movieModal').classList.contains('open')) return;
  fmFailLock = true;
  fmClearWatchdog();
  if (!fmEver && fmCur && fmCur.stream) FM_DEAD.add(fmCur.stream);
  fmShowStatus(reason + ' \u2014 dead stream. Retry, or try another movie.', true);
}
function fmRetry(){
  if (!fmCur) return;
  const ch = fmCur;
  fmClosePlayer(true);
  fmPlay(ch);
}
function fmNext(){
  const pool = fmView.filter(c => !FM_DEAD.has(c.stream) && (!fmCur || c.stream !== fmCur.stream));
  if (!pool.length){ fmToast('No other movies available'); return; }
  fmClosePlayer(true);
  fmPlay(pool[Math.floor(Math.random() * pool.length)]);
}

function fmPlayM3u8(video, url, player){
  /* Apple devices: Safari's built-in HLS player (its MSE is unreliable,
     and native playback doesn't demand CORS headers) */
  if (video.canPlayType('application/vnd.apple.mpegurl')){
    video.src = url;
    return;
  }
  if (window.Hls && Hls.isSupported()){
    if (player.hls){ try { player.hls.destroy(); } catch(e){} }
    let netRetries = 0, mediaRecovered = false;
    const hls = new Hls({
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 3,
      fragLoadingMaxRetry: 6,
      liveSyncDurationCount: 3,
      lowLatencyMode: false
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    player.hls = hls;
    hls.on(Hls.Events.ERROR, function(ev, data){
      if (!data || !data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR){
        if (!mediaRecovered){ mediaRecovered = true; try { hls.recoverMediaError(); return; } catch(e){} }
        fmFail('Media error'); return;
      }
      if (netRetries < 3){
        netRetries++;
        fmShowStatus('Reconnecting\u2026 (' + netRetries + '/3)', false);
        try { hls.startLoad(); return; } catch(e){}
      }
      fmFail('Stream unreachable');
    });
    player.on('destroy', function(){ try { hls.destroy(); } catch(e){} });
  } else {
    fmShowStatus('This device can\u2019t play HLS streams', true);
  }
}

async function fmPlay(ch){
  if (!(await fmEnsureEngine())){
    fmGet('fmPlayerTitle').textContent = ch ? ch.title : 'Movie';
    fmGet('fmPlayerSub').textContent = 'Video engine not loaded \u2014 every CDN fallback failed';
    fmGet('movieModal').classList.add('open');
    fmShowStatus('hls.js / artplayer could not load on this network. They load local-first if you put hls.min.js and artplayer.js next to movies.html.', true);
    return;
  }
  try {
    if (fmArt){ try { fmArt.destroy(); } catch(e){} fmArt = null; }
    fmCur = ch; fmEver = false; fmFailLock = false;
    fmClearWatchdog();
    let stream = String(ch.stream || '');
    let swapped = false;
    if (location.protocol === 'https:' && stream.indexOf('http://') === 0){ stream = 'https://' + stream.slice(7); swapped = true; }
    fmGet('fmPlayerTitle').textContent = ch.title || 'Movie';
    fmGet('fmPlayerSub').textContent = (ch.group || 'Movie') + (ch.country ? ' \u00b7 ' + ch.country : '');
    fmGet('movieModal').classList.add('open');
    document.body.classList.add('player-open');
    fmShowStatus(swapped ? 'Trying secure version\u2026 25s' : 'Connecting to stream\u2026 25s', false);
    fmStartWatchdog(25);
    const useHls = !fmIsNative(stream);
    fmArt = new Artplayer({
      container: '#fmPlayer',
      url: stream,
      type: useHls ? 'm3u8' : '',
      isLive: useHls,
      autoplay: true,
      volume: 1,
      setting: true,
      playbackRate: true,
      flip: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      pip: true,
      screenshot: true,
      autoSize: false,
      playsInline: true,
      customType: useHls ? { m3u8: fmPlayM3u8 } : {}
    });
    window.currentFmArt = fmArt;
    fmArt.on('ready', function(){
      fmClearWatchdog();
      const p = fmArt.video.play();
      if (p && p.catch) p.catch(function(){
        fmArt.muted = true;
        const p2 = fmArt.video.play();
        if (p2 && p2.catch) p2.catch(function(){ fmShowStatus('Stream ready \u2014 tap \u25b6 to start', false); });
        fmToast('Autoplay blocked \u2014 started muted, tap \ud83d\udd0a to unmute');
      });
    });
    fmArt.on('video:loadeddata', function(){
      fmClearWatchdog();
      fmHideStatus(); fmEver = true;
    });
    fmArt.on('video:error', function(){ /* hls handler covers fatal cases; native <video> errors land here */ });
  } catch(e){
    console.warn('[FATE MOVIES] player error:', e);
    fmShowStatus('Player error: ' + String((e && e.message) || e), true);
  }
}
function fmClosePlayer(keepModalOpenForSwap){
  fmClearWatchdog();
  if (fmArt){ try { fmArt.destroy(); } catch(e){} fmArt = null; window.currentFmArt = null; }
  if (!keepModalOpenForSwap){
    fmGet('movieModal').classList.remove('open');
    document.body.classList.remove('player-open');
    fmHideStatus();
  }
}
function fmPlayCustom(){
  const v = (fmGet('fmCustomUrl').value || '').trim();
  if (!v){ fmToast('Paste an .m3u8 or .mp4 link first'); return; }
  fmPlay({ title: 'Custom stream', group: 'custom', stream: v });
}

/* ---------- nav chip + auto-paint ---------- */
function fmPaintChip(){
  const el = fmGet('fmJetChip'); if (!el) return;
  let s = 'idle'; try { s = FATE_JET_STATE; } catch(e){}
  const lane = (typeof window !== 'undefined' && window.wlspServer) ? String(window.wlspServer).replace(/^wss:\/\//, '').replace(/\/$/, '') : '';
  const map = {
    idle: ['tunnel: idle', '#94a3b8', 'rgba(148,163,184,.25)'],
    booting: ['tunnel: booting\u2026', '#fbbf24', 'rgba(245,158,11,.3)'],
    ready: ['tunnel: ready' + (lane ? ' \u00b7 ' + lane.split('/')[0] : ''), '#4ade80', 'rgba(74,222,128,.3)'],
    'sw-failed': ['tunnel: sw error', '#f87171', 'rgba(248,113,113,.3)'],
    'transport-failed': ['tunnel: down', '#f87171', 'rgba(248,113,113,.3)'],
    'controller-failed': ['tunnel: error', '#f87171', 'rgba(248,113,113,.3)']
  };
  const [txt, col, bg] = map[s] || map.idle;
  el.textContent = txt;
  el.style.color = col; el.style.borderColor = bg; el.style.background = 'rgba(0,0,0,.4)';
}

/* ---------- boot ---------- */
(function fmBoot(){
  const start = () => {
    fmBuildSites();
    fmPaintChip();
    setInterval(fmPaintChip, 1200);
    setInterval(fmPaintStats, 2500);
    const search = fmGet('fmSearch');
    if (search) search.addEventListener('input', () => { fmQ = search.value || ''; fmApplyFilter(); });
    const custom = fmGet('fmCustomUrl');
    if (custom) custom.addEventListener('keydown', e => { if (e.key === 'Enter') fmPlayCustom(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && fmGet('movieModal').classList.contains('open')) fmClosePlayer();
    });
    fmLoadVault();
    /* auto-boot the tunnel: a movies page should be ready when the user taps */
    setTimeout(() => {
      try { if (typeof FATE_JET_STATE !== 'undefined' && FATE_JET_STATE === 'idle') fateJetBoot(); } catch(e){}
    }, 500);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
/* ===== END FATE MOVIES ENGINE ===== */
