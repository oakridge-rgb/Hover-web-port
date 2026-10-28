/* ===== FATE PORTAL v7 TIKTOK ENGINE ===== */
console.log('%c[FATE PORTAL v7] tiktok engine loaded', 'color:#f472b6;font-weight:bold;');

const TT_API = 'https://www.tikwm.com/api';
const TT_LANES = ['direct', 'allorigins', 'codetabs', 'wisp'];
const TT_LANE_KEY = 'fate_tiktok_lane_v7';
const TT_REGION_KEY = 'fate_tiktok_region_v7';
const TT_REGIONS = ['US', 'UK', 'DE', 'FR', 'JP', 'BR'];

let showTikTokOnly = false;
let ttItems = [];
let ttSeen = new Set();
let ttCursor = 0;
let ttHasMore = true;
let ttLoading = false;
let ttLane = localStorage.getItem(TT_LANE_KEY) || 'direct';
let ttRegion = localStorage.getItem(TT_REGION_KEY) || 'US';
let ttObserver = null;
let ttBlobMap = new Map();
let ttSearchMode = false;

/* ---------- lane fetchers: every lane returns text or throws ---------- */
async function ttFetchDirect(url, ms){
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 12000);
  try{
    const r = await fetch(url, { signal: c.signal });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function ttFetchAllorigins(url, ms){
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 15000);
  try{
    const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), { signal: c.signal });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function ttFetchCodetabs(url, ms){
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 15000);
  try{
    const r = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url), { signal: c.signal });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function ttFetchWisp(url, ms){
  const t = window.FATE_TRANSPORT || (typeof fateLoadTransport === 'function' ? await fateLoadTransport() : null);
  if(!t) throw new Error('transport not ready');
  const res = await Promise.race([
    t.request(new URL(url), 'GET', undefined, [['accept','application/json, text/plain, */*']], undefined).catch(e => ({ err: e })),
    new Promise(r => setTimeout(() => r({ err: new Error('wisp timeout') }), ms || 18000))
  ]);
  if(res.err) throw res.err;
  let rbody = res.body;
  try{
    if(rbody && typeof rbody.getReader === 'function'){
      const rd = rbody.getReader(); const v = await rd.read(); try{ await rd.cancel(); }catch(e){}
      rbody = v && v.value;
    }
  }catch(e){}
  const text = (rbody instanceof Uint8Array) ? new TextDecoder().decode(rbody) : String(rbody || '');
  if(res.status >= 400) throw new Error('HTTP ' + res.status);
  return text;
}

function ttLaneFetch(lane, url, ms){
  switch(lane){
    case 'direct': return ttFetchDirect(url, ms);
    case 'allorigins': return ttFetchAllorigins(url, ms);
    case 'codetabs': return ttFetchCodetabs(url, ms);
    case 'wisp': return ttFetchWisp(url, ms);
    default: return ttFetchDirect(url, ms);
  }
}

/* try lanes: remembered winner first, then the rest. Returns {data, lane}.
   tikwm sometimes truncates bodies under load — one automatic retry ladder. */
async function ttApiGet(path){
  let lastErr = null;
  for(let attempt = 0; attempt < 2; attempt++){
    if(attempt > 0){
      ttSetChip('retrying…', '#fbbf24');
      await new Promise(r => setTimeout(r, 1400));
    }
    const order = [ttLane, ...TT_LANES.filter(l => l !== ttLane)];
    for(const lane of order){
      try{
        const text = await ttLaneFetch(lane, TT_API + path);
        const j = JSON.parse(text);
        if(j && j.code === 0 && j.data){
          if(lane !== ttLane){ ttLane = lane; localStorage.setItem(TT_LANE_KEY, lane); }
          ttSetChip('lane ' + lane, '#4ade80');
          return j;
        }
        lastErr = new Error('api ' + (j && j.msg ? j.msg : 'error ' + (j && j.code)));
      }catch(e){ lastErr = e; }
    }
  }
  ttSetChip('all lanes failed', '#f87171');
  throw lastErr || new Error('all tiktok lanes failed');
}

/* ---------- UI helpers ---------- */
function ttSetChip(text, color){
  const c = $('ttStatusChip');
  if(c) c.innerHTML = '<span style="color:' + (color || '#94a3b8') + ';font-weight:700;">' + text + '</span>';
}

function ttFmtCount(n){
  n = Number(n) || 0;
  if(n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if(n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if(n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function ttSecs(s){ s = Number(s) || 0; const m = Math.floor(s / 60); const r = Math.floor(s % 60); return m + ':' + (r < 10 ? '0' : '') + r; }

/* ---------- feed loading ---------- */
async function ttLoadFeed(){
  if(ttLoading) return;
  ttLoading = true;
  ttSetChip('loading…', '#fbbf24');
  $('ttFeedStatus').style.display = 'flex';
  $('ttFeedStatus').innerHTML = '<div class="tt-spinner"></div><span style="color:#94a3b8;font-size:.85rem;">Loading For You feed…</span>';
  try{
    const q = ttSearchMode
      ? '/feed/search?keywords=' + encodeURIComponent(ttKeywords) + '&count=12&region=' + ttRegion + '&cursor=' + ttCursor
      : '/feed/list?count=12&region=' + ttRegion + '&cursor=' + ttCursor;
    const j = await ttApiGet(q);
    const list = (ttSearchMode ? (j.data.videos || []) : (j.data || []));
    let added = 0;
    for(const it of list){
      if(!it || !it.video_id || ttSeen.has(it.video_id)) continue;
      if(!it.play) continue;
      ttSeen.add(it.video_id);
      ttItems.push(it);
      ttAppendCard(it);
      added++;
    }
    ttCursor = Number(j.data && j.data.cursor) || (ttCursor + 12);
    ttHasMore = added > 0;
    $('ttFeedStatus').style.display = 'none';
    if(ttItems.length === 0){
      $('ttFeedStatus').style.display = 'flex';
      $('ttFeedStatus').innerHTML = ttSearchMode
        ? '<span style="color:#94a3b8;font-size:.9rem;">No results for "' + ttKeywords.replace(/</g, '&lt;') + '"</span>'
        : '<span style="color:#94a3b8;font-size:.9rem;">Feed came back empty — try the reload button.</span>';
    }
    ttSetChip(ttItems.length + ' videos · lane ' + ttLane, '#4ade80');
  }catch(e){
    $('ttFeedStatus').style.display = 'flex';
    $('ttFeedStatus').innerHTML = '<span style="color:#f87171;font-size:.85rem;">Feed failed on every lane (' + String(e.message || e).replace(/</g, '&lt;') + ') — check the tunnel in Cloud view, then hit Reload.</span>';
  }finally{
    ttLoading = false;
    ttSetupObserver();
  }
}

let ttKeywords = '';

/* ---------- blob fallback for blocked video CDNs ---------- */
async function ttBlobUrl(url){
  if(ttBlobMap.has(url)) return ttBlobMap.get(url);
  const blob = await (async () => {
    try{ return await (await ttFetchDirect(url, 20000)).blob(); }
    catch(e){ return await (await ttFetchWisp(url, 25000)).blob(); }
  })();
  const u = URL.createObjectURL(blob);
  ttBlobMap.set(url, u);
  return u;
}

/* ---------- card rendering ---------- */
function ttAppendCard(it){
  const wrap = document.createElement('div');
  wrap.className = 'tt-card';
  wrap.setAttribute('data-vid', it.video_id);

  const vid = document.createElement('video');
  vid.className = 'tt-video';
  vid.playsInline = true;
  vid.loop = true;
  vid.muted = true;
  vid.preload = 'metadata';
  vid.setAttribute('playsinline', '');
  if(it.cover) vid.poster = it.cover;
  vid.src = it.play;
  vid.addEventListener('error', async () => {
    if(wrap.getAttribute('data-blobbed')) return;
    wrap.setAttribute('data-blobbed', '1');
    try{
      vid.src = await ttBlobUrl(it.play);
      vid.play().catch(() => {});
    }catch(e){ ttSetChip('video blocked on all lanes', '#f87171'); }
  }, { once: true });

  const tap = document.createElement('div');
  tap.className = 'tt-tap';
  tap.addEventListener('click', () => {
    if(vid.paused) vid.play().catch(() => {}); else vid.pause();
    tap.querySelector('.tt-playicon').style.opacity = vid.paused ? '0' : '1';
  });
  vid.addEventListener('play', () => { tap.querySelector('.tt-playicon').style.opacity = '0'; });
  vid.addEventListener('pause', () => { tap.querySelector('.tt-playicon').style.opacity = '1'; });

  const prog = document.createElement('div');
  prog.className = 'tt-progress';
  const progFill = document.createElement('div');
  progFill.className = 'tt-progress-fill';
  prog.appendChild(progFill);
  vid.addEventListener('timeupdate', () => {
    if(vid.duration) progFill.style.width = ((vid.currentTime / vid.duration) * 100) + '%';
  });

  const playIcon = document.createElement('div');
  playIcon.className = 'tt-playicon';
  playIcon.innerHTML = '<svg width="54" height="54" viewBox="0 0 24 24" fill="rgba(255,255,255,.85)"><path d="M8 5v14l11-7z"/></svg>';
  tap.appendChild(playIcon);

  const rail = document.createElement('div');
  rail.className = 'tt-rail';
  const railBtn = (icon, count, label) => {
    const d = document.createElement('div');
    d.className = 'tt-rail-item';
    d.title = label;
    d.innerHTML = icon + '<span>' + ttFmtCount(count) + '</span>';
    return d;
  };
  rail.appendChild(railBtn('<svg viewBox="0 0 24 24" fill="#fe2c55"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>', it.digg_count, 'likes'));
  rail.appendChild(railBtn('<svg viewBox="0 0 24 24" fill="rgba(255,255,255,.9)"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>', it.comment_count, 'comments'));
  rail.appendChild(railBtn('<svg viewBox="0 0 24 24" fill="rgba(255,255,255,.9)"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>', it.share_count, 'shares'));
  rail.appendChild(railBtn('<svg viewBox="0 0 24 24" fill="rgba(255,255,255,.9)"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>', it.play_count, 'plays'));

  const overlay = document.createElement('div');
  overlay.className = 'tt-overlay';
  const author = document.createElement('div');
  author.className = 'tt-author';
  author.textContent = '@' + String((it.author && it.author.unique_id) || 'unknown');
  const desc = document.createElement('div');
  desc.className = 'tt-desc';
  desc.textContent = String(it.title || '').slice(0, 220) || '(no caption)';
  const music = document.createElement('div');
  music.className = 'tt-music';
  music.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg> <span></span>';
  music.querySelector('span').textContent = String((it.music_info && it.music_info.title) || 'original sound').slice(0, 60);
  const meta = document.createElement('div');
  meta.className = 'tt-meta';
  meta.textContent = ttSecs(it.duration) + ' · no watermark · ' + String(it.region || ttRegion);
  overlay.appendChild(author); overlay.appendChild(desc); overlay.appendChild(music); overlay.appendChild(meta);

  const muteBtn = document.createElement('button');
  muteBtn.className = 'tt-mute';
  muteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.tt-video').forEach(v => { v.muted = !v.muted; });
    document.querySelectorAll('.tt-mute').forEach(b => b.classList.toggle('tt-unmuted', !vid.muted));
  });

  wrap.appendChild(vid);
  wrap.appendChild(tap);
  wrap.appendChild(prog);
  wrap.appendChild(rail);
  wrap.appendChild(overlay);
  wrap.appendChild(muteBtn);
  $('ttFeed').appendChild(wrap);
}

/* ---------- observer: autoplay the card in view ---------- */
function ttSetupObserver(){
  if(ttObserver) ttObserver.disconnect();
  ttObserver = new IntersectionObserver((entries) => {
    for(const en of entries){
      const v = en.target.querySelector('.tt-video');
      if(!v) continue;
      if(en.isIntersecting && en.intersectionRatio >= 0.6){
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
  }, { root: $('ttFeed'), threshold: [0, 0.6, 1] });
  document.querySelectorAll('.tt-card').forEach(c => ttObserver.observe(c));
}

/* ---------- view switching ---------- */
function ttCloseView(){
  showTikTokOnly = false;
  const sec = $('tiktokSection');
  if(sec) sec.style.display = 'none';
  const btn = $('tiktokToggle');
  if(btn) btn.classList.remove('active');
  const label = $('tiktokLabel');
  if(label) label.textContent = 'TikTok';
  stopTikTokPlayback();
}
function stopTikTokPlayback(){
  document.querySelectorAll('.tt-video').forEach(v => { try{ v.pause(); }catch(e){} });
}
function toggleTikTokView(){
  showTikTokOnly = !showTikTokOnly;
  if(showTikTokOnly){
    showCloudOnly = false;
    showFavoritesOnly = false;
    if(typeof syncCloudViewUI === 'function') syncCloudViewUI();
    $('favToggle').classList.remove('active');
    $('favLabel').textContent = 'Favorites';
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.pill[data-filter="all"]').classList.add('active');
    syncTikTokViewUI();
  } else {
    syncTikTokViewUI();
    applyFilters();
  }
}

function syncTikTokViewUI(){
  const btn = $('tiktokToggle');
  if(btn) btn.classList.toggle('active', showTikTokOnly);
  const label = $('tiktokLabel');
  if(label) label.textContent = showTikTokOnly ? 'Close TikTok' : 'TikTok';
  const sec = $('tiktokSection');
  if(!sec) return;
  sec.style.display = showTikTokOnly ? 'block' : 'none';
  if(showTikTokOnly){
    $('gamesGrid').style.display = 'none';
    $('skeletonGrid').style.display = 'none';
    $('emptyState').style.display = 'none';
    $('loadMoreWrap').style.display = 'none';
    const pills = $('pills'); if(pills) pills.style.display = 'none';
    const recent = $('recentSection'); if(recent) recent.style.display = 'none';
    const cs = $('cloudSection'); if(cs) cs.style.display = 'none';
    stopTikTokPlayback();
    if(ttItems.length === 0) ttLoadFeed();
    else ttSetupObserver();
  } else {
    stopTikTokPlayback();
  }
}

/* ---------- reload / region / search ---------- */
function reloadTikTok(){
  ttItems = []; ttSeen = new Set(); ttCursor = 0; ttHasMore = true;
  const feed = $('ttFeed'); if(feed) feed.innerHTML = '';
  ttObserver = null;
  ttLoadFeed();
}
function setTikTokRegion(r){
  ttRegion = r;
  localStorage.setItem(TT_REGION_KEY, r);
  document.querySelectorAll('.tt-region').forEach(b => b.classList.toggle('active', b.getAttribute('data-region') === r));
  reloadTikTok();
}
function ttDoSearch(){
  const kw = $('ttSearchInput').value.trim();
  if(!kw) return;
  ttKeywords = kw;
  ttSearchMode = true;
  reloadTikTok();
}
function ttClearSearch(){
  $('ttSearchInput').value = '';
  ttSearchMode = false; ttKeywords = '';
  reloadTikTok();
}

/* infinite scroll inside the feed scroller */
(function(){
  const feed = $('ttFeed');
  if(!feed) return;
  feed.addEventListener('scroll', () => {
    if(!showTikTokOnly || !ttHasMore || ttLoading) return;
    if(feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 600) ttLoadFeed();
  }, { passive: true });
})();

/* warm the tunnel so the wisp lane is ready if direct lanes are blocked */
if(typeof fateLoadTransport === 'function') fateLoadTransport().catch(() => {});
/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */
