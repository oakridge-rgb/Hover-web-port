/* ===== FATE BROWSER ENGINE (multi-tab web browser over the jet tunnel) ===== */
console.log('%c[FATE BROWSER] engine loaded', 'color:#38bdf8;font-weight:bold;');

function fbGet(id){ return document.getElementById(id); }

function fbToast(msg){
  try {
    let t = document.getElementById('fbToast');
    if (!t){ t = document.createElement('div'); t.id = 'fbToast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:2147483000;background:rgba(12,10,9,.95);border:1px solid rgba(56,189,248,.5);color:#7dd3fc;font:600 13px/1.4 system-ui,sans-serif;padding:.6rem 1rem;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:92vw;transition:opacity .25s;opacity:0;pointer-events:none;';
      document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(fbToast._t); fbToast._t = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  } catch(e){}
}

/* ---------- start-page shortcut tiles (reference SHORTCUTS set, no games) ---------- */
const FB_SITES = [
  { label: 'TikTok', url: 'https://www.tiktok.com/foryou', color: '#25f4ee',
    icon: '<path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>' },
  { label: 'YouTube', url: 'https://youtube.com/', color: '#ff0000',
    icon: '<path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.42-4.81zM10 15V9l5.2 3z"/>' },
  { label: 'Snapchat', url: 'https://www.snapchat.com/web', color: '#fffc00',
    icon: '<path d="M12 2c3 0 5 2.2 5 5.2 0 1.1-.1 2.1-.2 3 .5.2 1.1 0 1.6-.2.6-.2 1.2-.1 1.4.4.2.6-.3 1-1 1.4-.6.3-1.5.7-1.6 1.3-.1.5.3 1.2 1 2 .8 1 2 2.1 3.5 2.5.4.1.6.5.4.9-.1.3-.5.6-1.2.8-.5.1-1 .2-1.2.5-.1.2-.1.5-.2.8-.1.3-.3.5-.7.4-.5-.1-1.1-.2-1.8-.1-.7.1-1.3.4-2 .8-.9.6-1.9 1.3-3.2 1.3s-2.3-.7-3.2-1.3c-.7-.4-1.3-.7-2-.8-.7-.1-1.3 0-1.8.1-.4.1-.6-.1-.7-.4-.1.3-.1-.6-.2-.8-.2-.3-.7-.4-1.2-.5-.7-.2-1.1-.5-1.2-.8-.2-.4 0-.8.4-.9C4.5 18 5.7 16.9 6.5 15.9c.7-.8 1.1-1.5 1-2-.1-.6-1-1-1.6-1.3-.7-.4-1.2-.8-1-1.4.2-.5.8-.6 1.4-.4.5.2 1.1.4 1.6.2-.1-.9-.2-1.9-.2-3C7 4.2 9 2 12 2z"/>' },
  { label: 'Instagram', url: 'https://instagram.com', color: '#e1306c',
    icon: '<path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm5.8-4.3a1.2 1.2 0 1 1-1.2 1.2 1.2 1.2 0 0 1 1.2-1.2z"/>' },
  { label: 'Discord', url: 'https://discord.com/app', color: '#5865f2',
    icon: '<path d="M19.6 5.9A16.3 16.3 0 0 0 15.9 4.7l-.5 1a15 15 0 0 0-6.8 0l-.5-1A16.3 16.3 0 0 0 4.4 5.9 17.6 17.6 0 0 0 1.5 17a16.6 16.6 0 0 0 5 2.6l.9-1.5a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 11.8 0l.4.3a10.8 10.8 0 0 1-1.7.8l.9 1.5a16.6 16.6 0 0 0 5-2.6 17.6 17.6 0 0 0-2.9-11.1zM8.7 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>' },
  { label: 'Twitch', url: 'https://twitch.tv', color: '#9146ff',
    icon: '<path d="M4 2L2 6v14h5v3h3l3-3h4l5-5V2H4zm16 11l-3 3h-5l-3 3v-3H5V4h15v9zM15 7h2v5h-2V7zm-5 0h2v5h-2V7z"/>' },
  { label: 'Reddit', url: 'https://www.reddit.com/', color: '#ff4500',
    icon: '<path d="M22 12a2.2 2.2 0 0 0-2.2-2.2c-.6 0-1.1.2-1.5.6a10.8 10.8 0 0 0-5.6-1.7l1-4.5 3.2.7a1.6 1.6 0 1 0 .2-1l-3.7-.8a.5.5 0 0 0-.6.4l-1.1 5.2c-2.1.1-4 .7-5.6 1.7a2.2 2.2 0 1 0-2.4 3.6 4.3 4.3 0 0 0 0 .6c0 3.3 3.8 6 8.5 6s8.5-2.7 8.5-6v-.6A2.2 2.2 0 0 0 22 12zM8 13.7a1.6 1.6 0 1 1 1.6 1.6 1.6 1.6 0 0 1-1.6-1.6zm7.9 3.1a4.8 4.8 0 0 1-3.9 1.2 4.8 4.8 0 0 1-3.9-1.2.4.4 0 0 1 .6-.6 4 4 0 0 0 3.3 1 4 4 0 0 0 3.3-1 .4.4 0 1 1 .6.6zm-.3-1.5a1.6 1.6 0 1 1 1.6-1.6 1.6 1.6 0 0 1-1.6 1.6z"/>' },
  { label: 'Wikipedia', url: 'https://www.wikipedia.org/', color: '#94a3b8',
    icon: '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.4a15.6 15.6 0 0 0-1.2-5.7A8 8 0 0 1 19.9 11zM12 4a13.8 13.8 0 0 1 1.9 7h-3.8A13.8 13.8 0 0 1 12 4zM4.1 13h3.4a15.6 15.6 0 0 0 1.2 5.7A8 8 0 0 1 4.1 13zm3.4-2H4.1a8 8 0 0 1 4.6-5.7A15.6 15.6 0 0 0 7.5 11zM12 20a13.8 13.8 0 0 1-1.9-7h3.8A13.8 13.8 0 0 1 12 20zm2.3-.3a15.6 15.6 0 0 0 1.2-5.7h3.4a8 8 0 0 1-4.6 5.7z"/>' },
  { label: 'Google', url: 'https://www.google.com/', color: '#4285f4',
    icon: '<path d="M21.35 11.1H12v2.9h5.35a4.6 4.6 0 0 1-2 3v2.5h2.9a8.6 8.6 0 0 0 3.1-8.4z"/><path d="M12 21a8.6 8.6 0 0 0 5.85-2.1l-2.9-2.3a5.4 5.4 0 0 1-8.1-2.8H3.9v2.6A9 9 0 0 0 12 21z"/><path d="M6.85 13.8a5.4 5.4 0 0 1 0-3.6V7.6H3.9a9 9 0 0 0 0 8.8z"/><path d="M12 6.6a4.9 4.9 0 0 1 3.44 1.34l2.6-2.6A8.7 8.7 0 0 0 3.9 7.6l2.95 2.6A5.4 5.4 0 0 1 12 6.6z"/>' }
];

/* ---------- tab state ---------- */
const FB_TABS = [];
let fbActive = null;
let fbSeq = 0;
const fbSleep = ms => new Promise(r => setTimeout(r, ms));

function fbActiveTab(){ return FB_TABS.find(t => t.id === fbActive) || null; }
function fbTitleFor(url){
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e){ return (url || '').slice(0, 40) || 'New Tab'; }
}

/* ---------- URL normalization: search box semantics ---------- */
function fbNormalize(v){
  v = (v || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(about|data|javascript):/i.test(v)) return null;
  const looksDomain = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$|\?|#)/.test(v) || /^localhost(:\d+)?(\/|$)/.test(v);
  if (looksDomain) return 'https://' + v;
  return 'https://www.google.com/search?q=' + encodeURIComponent(v) + '&udm=14';
}

/* ---------- per-frame codec decode (each tab has its own frame prefix) ---------- */
function fbDecode(tab, href){
  try {
    if (typeof FATE_JET === 'undefined' || !FATE_JET) return null;
    const p = new URL(href, location.href).pathname;
    const prefixes = [];
    if (tab.frame) prefixes.push(tab.frame.prefix);
    prefixes.push(FATE_JET.prefix);
    for (const px of prefixes){
      if (px && p.startsWith(px)) return FATE_JET.config.codec.decode(p.slice(px.length));
    }
    return null;
  } catch(e){ return null; }
}
function fbEncode(tab, url){
  try {
    if (typeof FATE_JET === 'undefined' || !FATE_JET) return url;
    return location.origin + FATE_JET.prefix + FATE_JET.config.codec.encode(url);
  } catch(e){ return url; }
}

/* ---------- per-tab plugins (link clicks + SPA url changes ride the tab) ---------- */
function fbPlugins(tab){
  const plugs = [];
  if (typeof FATE_HAS_UTILS === 'undefined' || !FATE_HAS_UTILS || !window.$jetUtils) return plugs;
  try {
    plugs.push(new $jetUtils.EventHandlerPlugin());
    plugs.push(new $jetUtils.LinkHandlerPlugin(href => { try { if (href) fbNavigate(tab, href); } catch(e){} }));
    plugs.push(new $jetUtils.UrlWatcherPlugin(href => {
      try {
        if (!href) return;
        if (tab.stack[tab.idx] !== href){
          tab.stack = tab.stack.slice(0, tab.idx + 1);
          tab.stack.push(href); tab.idx = tab.stack.length - 1;
        }
        tab.url = href;
        if (tab.id === fbActive) fbPaintToolbar();
        fbPaintPane(tab); fbSaveSession();
      } catch(e){}
    }));
    plugs.push(new $jetUtils.HttpCachePlugin());
  } catch(e){ console.warn('[FATE BROWSER] utils plugins unavailable:', e); }
  return plugs;
}

/* ---------- recents (localStorage, start page) ---------- */
function fbRecordHist(url){
  try {
    if (!url || !/^https?:/i.test(url)) return;
    if (url.indexOf(location.origin) === 0) return;
    /* key = origin + path (query/hash dropped): redirect & challenge variants
       of the same page collapse into one recent chip */
    const key = (() => { try { const u = new URL(url); return u.origin + u.pathname.replace(/\/+$/, ''); } catch(e){ return url; } })();
    const H = JSON.parse(localStorage.getItem('fate_browser_hist') || '[]');
    const rest = H.filter(x => {
      /* normalize legacy entries (stored before keys existed) the same way */
      const xk = x.k || (() => { try { const u = new URL(x.u); return u.origin + u.pathname.replace(/\/+$/, ''); } catch(e){ return x.u; } })();
      return xk !== key;
    });
    rest.unshift({ u: url, k: key, t: Date.now() });
    localStorage.setItem('fate_browser_hist', JSON.stringify(rest.slice(0, 48)));
  } catch(e){}
}

/* ---------- session save / restore (survives self-heal reloads) ---------- */
function fbSaveSession(){
  try {
    const urls = FB_TABS.map(t => t.pendingUrl || t.url).filter(Boolean);
    const active = Math.max(0, FB_TABS.findIndex(t => t.id === fbActive));
    sessionStorage.fateBrowserTabs = JSON.stringify({ urls: urls, active: active });
  } catch(e){}
}

/* ---------- pane painting ---------- */
function fbConnectShow(tab, msg){
  try {
    tab.pane.classList.add('connecting');
    const s = tab.pane.querySelector('.fb-connect span');
    if (s) s.textContent = msg || '';
  } catch(e){}
}
function fbConnectHide(tab){ try { tab.pane.classList.remove('connecting'); } catch(e){} }

function fbPaintPane(tab){
  try {
    const home = !tab.url && !tab.pendingUrl;
    tab.pane.classList.toggle('at-home', home);
    tab.pane.classList.toggle('loading', !!tab.loading && !home);
  } catch(e){}
}

function fbPaintRecents(tab){
  try {
    const wrap = tab.pane.querySelector('.fb-recent');
    const row = tab.pane.querySelector('.fb-recent-row');
    if (!wrap || !row) return;
    row.innerHTML = '';
    let H = [];
    try { H = JSON.parse(localStorage.getItem('fate_browser_hist') || '[]'); } catch(e){}
    const items = H.slice(0, 6);
    wrap.style.display = items.length ? 'block' : 'none';
    items.forEach(x => {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'fb-recent-chip';
      const dot = document.createElement('span'); dot.className = 'dot';
      const host = fbTitleFor(x.u);
      c.appendChild(dot); c.appendChild(document.createTextNode(host));
      c.onclick = () => fbNavigate(tab, x.u);
      row.appendChild(c);
    });
  } catch(e){}
}

function fbPaintTileGrid(tab){
  try {
    const grid = tab.pane.querySelector('.fb-tiles');
    if (!grid || grid.dataset.built) return;
    grid.dataset.built = '1';
    FB_SITES.forEach(s => {
      const d = document.createElement('div');
      d.className = 'fb-tile';
      d.innerHTML = '<span class="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="' + s.color + '">' + s.icon + '</svg></span><span class="lbl">' + s.label + '</span>';
      d.onclick = () => fbNavigate(tab, s.url);
      grid.appendChild(d);
    });
  } catch(e){}
}

/* ---------- tab strip ---------- */
function fbPaintStrip(){
  const row = fbGet('fbTabs'); if (!row) return;
  row.innerHTML = '';
  FB_TABS.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'fb-tab' + (tab.id === fbActive ? ' active' : '');
    const ic = document.createElement('span');
    ic.className = 'fb-tab-ic' + (tab.loading ? ' loading' : '');
    if (!tab.loading) ic.textContent = (tab.title || '?').trim().charAt(0).toUpperCase() || '?';
    const ti = document.createElement('span');
    ti.className = 'fb-tab-title'; ti.textContent = tab.title || 'New Tab';
    const x = document.createElement('span');
    x.className = 'fb-tab-x'; x.textContent = '\u00d7';
    el.appendChild(ic); el.appendChild(ti); el.appendChild(x);
    el.addEventListener('click', () => fbActivate(tab.id));
    x.addEventListener('click', e => { e.stopPropagation(); fbCloseTab(tab.id); });
    row.appendChild(el);
    if (tab.id === fbActive){ try { el.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch(e){} }
  });
}

function fbPaintToolbar(){
  const t = fbActiveTab(); if (!t) return;
  const addr = fbGet('fbAddr');
  if (addr && document.activeElement !== addr) addr.value = t.url || t.pendingUrl || '';
  fbPaintPane(t);
}

function fbSetTitle(tab, title){
  tab.title = (title || '').trim() || 'New Tab';
  fbPaintStrip();
}

/* ---------- tunnel chip ---------- */
function fbPaintChip(){
  const el = fbGet('fbJetChip'); if (!el) return;
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
  const m = map[s] || map.idle;
  el.textContent = m[0];
  el.style.color = m[1]; el.style.borderColor = m[2]; el.style.background = 'rgba(0,0,0,.4)';
}

/* ---------- navigation ---------- */
function fbNavigate(tab, url, opts){
  if (!tab || !url) return;
  if (!/^https?:\/\//i.test(url)){ const n = fbNormalize(url); if (!n) return; url = n; }
  const ready = (typeof FATE_JET !== 'undefined') && FATE_JET && (typeof FATE_JET_STATE !== 'undefined') && FATE_JET_STATE === 'ready';

  if (!ready){
    /* tunnel not up yet: queue + auto-boot; flushed by the tick when ready */
    tab.pendingUrl = url; tab.loading = false;
    fbSetTitle(tab, fbTitleFor(url));
    fbPaintToolbar(); fbPaintStrip();
    const host = fbTitleFor(url);
    let why = 'tunnel booting \u2014 opening ' + host + ' the moment it\u2019s ready';
    try { if (FATE_JET_STATE === 'transport-failed') why = 'wisp tunnel down \u2014 retrying lanes for ' + host + '\u2026'; } catch(e){}
    fbConnectShow(tab, why);
    try {
      if (FATE_JET_STATE === 'idle' || FATE_JET_STATE === 'transport-failed' || FATE_JET_STATE === 'controller-failed' || FATE_JET_STATE === 'sw-failed') fateJetBoot();
    } catch(e){}
    fbSaveSession();
    return;
  }

  fbConnectHide(tab);
  if (!tab.frame){
    try {
      tab.frame = FATE_JET.createFrame(tab.iframe, { plugins: fbPlugins(tab) });
    } catch(e){
      console.warn('[FATE BROWSER] createFrame failed:', e);
      tab.pendingUrl = url; fbConnectShow(tab, 'tunnel hiccup \u2014 retrying\u2026');
      return;
    }
  }
  tab.loading = true;
  tab.url = url;
  if (!(opts && opts.fromFrame)){
    if (opts && opts.replace){ tab.stack[tab.idx] = url; }
    else if (tab.stack[tab.idx] !== url){
      tab.stack = tab.stack.slice(0, tab.idx + 1);
      tab.stack.push(url); tab.idx = tab.stack.length - 1;
    }
  }
  fbSetTitle(tab, fbTitleFor(url));
  fbPaintToolbar(); fbPaintStrip();
  try { tab.frame.go(url); }
  catch(e){ console.warn('[FATE BROWSER] frame.go failed:', e); try { tab.iframe.src = fbEncode(tab, url); } catch(e2){} }
  fbRecordHist(url);
  fbSaveSession();
}

function fbGo(input){
  const t = fbActiveTab(); if (!t) return;
  const u = fbNormalize(input);
  if (!u){ fbToast('Type a URL or search words'); return; }
  fbNavigate(t, u);
  const addr = fbGet('fbAddr'); if (addr) addr.blur();
}

/* ---------- toolbar actions (stack-based back/forward: predictable, never
   walks into the iframe's initial about:blank history entry; in-page link
   clicks and SPA pushState are recorded by the plugins + load sync) ---------- */
function fbBack(){
  const t = fbActiveTab(); if (!t) return;
  if (t.idx > 0){ t.idx--; fbNavigate(t, t.stack[t.idx], { fromFrame: true }); }
  else fbToast('Start of history');
}
function fbForward(){
  const t = fbActiveTab(); if (!t) return;
  if (t.idx < t.stack.length - 1){ t.idx++; fbNavigate(t, t.stack[t.idx], { fromFrame: true }); }
  else fbToast('End of history');
}
function fbReload(){
  const t = fbActiveTab(); if (!t) return;
  if (t.frame){ try { t.frame.reload(); return; } catch(e){} }
  if (t.url) fbNavigate(t, t.url, { replace: true });
}
function fbHome(){
  const t = fbActiveTab(); if (!t) return;
  t.url = null; t.pendingUrl = null; t.loading = false;
  fbConnectHide(t);
  fbSetTitle(t, 'New Tab');
  fbPaintRecents(t);
  fbPaintToolbar(); fbPaintStrip(); fbSaveSession();
  try { const addr = fbGet('fbAddr'); addr.value = ''; } catch(e){}
}
function fbPopout(){
  const t = fbActiveTab(); if (!t) return;
  const u = t.url || t.pendingUrl;
  if (u) window.open(u, '_blank');
  else fbToast('Nothing to pop out \u2014 open a site first');
}

/* ---------- tab lifecycle ---------- */
function fbNewTab(url){
  fbSeq++;
  const tab = { id: 'fbt' + fbSeq, title: 'New Tab', url: null, stack: [], idx: -1, frame: null, iframe: null, pane: null, pendingUrl: null, loading: false };

  const pane = document.createElement('div');
  pane.className = 'fb-pane'; pane.dataset.tab = tab.id;
  pane.innerHTML =
    '<div class="fb-start"><div class="fb-start-scroll">' +
      '<div class="fb-brandrow"><div class="fb-logo">F</div><div><h1>FATE Browser</h1><p>the real web, through your wisp tunnel</p></div></div>' +
      '<div class="fb-srow"><input class="fb-search" placeholder="Search Google or type a URL" spellcheck="false" autocomplete="off"><button class="fb-go" type="button">Go</button></div>' +
      '<div class="fb-tiles"></div>' +
      '<a class="fb-movies" href="movies.html">' +
        '<svg viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>' +
        '<span><b>FATE Movies</b><i>dedicated cinema page \u2014 vault + stream sites</i></span></a>' +
      '<div class="fb-recent" style="display:none"><h3>Recent</h3><div class="fb-recent-row"></div></div>' +
      '<div class="fb-note">Keep this tab open and in the foreground while you browse \u2014 it powers the tunnel. iPads freeze background tabs and drop the lane.</div>' +
    '</div></div>' +
    '<iframe class="fb-frame" referrerpolicy="no-referrer" allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen></iframe>' +
    '<div class="fb-progress"></div>' +
    '<div class="fb-connect"><div class="fb-spin"></div><b>routing through the tunnel</b><span></span></div>';

  tab.pane = pane;
  tab.iframe = pane.querySelector('.fb-frame');
  fbGet('fbPanes').appendChild(pane);

  /* start-page bindings */
  const search = pane.querySelector('.fb-search');
  const sgo = pane.querySelector('.fb-go');
  const doSearch = () => fbGo(search.value);
  sgo.addEventListener('click', doSearch);
  search.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  /* iframe load: decode the real URL, pull the title, sync the stack */
  tab.iframe.addEventListener('load', () => {
    let real = null;
    try { real = fbDecode(tab, tab.iframe.contentWindow.location.href); } catch(e){ real = null; }
    if (!real) return;
    tab.loading = false;
    tab.url = real;
    const norm = u => String(u || '').replace(/\/+$/, '');
    if (tab.idx >= 0 && tab.stack[tab.idx] !== real){
      const cur = tab.stack[tab.idx];
      /* redirect / hash / query variants of the SAME document replace in place
         (otherwise Back would look like a no-op on redirecting sites) */
      if (norm(real) === norm(cur) || real.indexOf(cur + '#') === 0 || real.indexOf(cur + '?') === 0){
        tab.stack[tab.idx] = real;
      } else {
        tab.stack = tab.stack.slice(0, tab.idx + 1);
        tab.stack.push(real); tab.idx = tab.stack.length - 1;
      }
    } else if (tab.idx < 0){
      tab.stack = [real]; tab.idx = 0;
    }
    let title = '';
    try { title = tab.iframe.contentDocument.title || ''; } catch(e){ title = ''; }
    fbSetTitle(tab, title || fbTitleFor(real));
    fbConnectHide(tab);
    fbRecordHist(real);
    if (tab.id === fbActive) fbPaintToolbar();
    fbPaintStrip(); fbSaveSession();
  });

  FB_TABS.push(tab);
  fbActivate(tab.id);
  fbPaintRecents(tab);
  fbPaintTileGrid(tab);
  if (url) fbNavigate(tab, url);
  fbSaveSession();
  return tab;
}

function fbCloseTab(id){
  const i = FB_TABS.findIndex(t => t.id === id);
  if (i < 0) return;
  const tab = FB_TABS[i];
  try { tab.iframe.src = 'about:blank'; } catch(e){}
  tab.frame = null;
  tab.pane.remove();
  FB_TABS.splice(i, 1);
  if (fbActive === id){
    const next = FB_TABS[Math.min(i, FB_TABS.length - 1)];
    if (next) fbActivate(next.id);
    else { fbNewTab(null); return; }
  }
  fbPaintStrip(); fbSaveSession();
}

function fbActivate(id){
  fbActive = id;
  FB_TABS.forEach(t => t.pane.classList.toggle('active', t.id === id));
  fbPaintStrip(); fbPaintToolbar();
  const t = fbActiveTab();
  if (t) fbPaintRecents(t);
}

/* ---------- boot watcher: chip, loading bars, pending flush ---------- */
function fbTick(){
  fbPaintChip();
  const ready = (typeof FATE_JET !== 'undefined') && FATE_JET && (typeof FATE_JET_STATE !== 'undefined') && FATE_JET_STATE === 'ready';
  FB_TABS.forEach(tab => {
    tab.pane.classList.toggle('loading', !!tab.loading);
    if (tab.pendingUrl && ready){
      const u = tab.pendingUrl;
      tab.pendingUrl = null;
      fbNavigate(tab, u);
    }
  });
}

/* ---------- keyboard (desktop bonus) ---------- */
function fbBindKeys(){
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 't' || e.key === 'T')){ e.preventDefault(); fbNewTab(null); }
    else if (mod && (e.key === 'w' || e.key === 'W')){ e.preventDefault(); const t = fbActiveTab(); if (t) fbCloseTab(t.id); }
    else if (mod && (e.key === 'l' || e.key === 'L')){ e.preventDefault(); const a = fbGet('fbAddr'); a.focus(); a.select(); }
  });
}

/* ---------- init ---------- */
(function fbInit(){
  const start = () => {
    /* session restore: sessionStorage is per-top-level-tab, so a same-tab reload
       (manual OR self-heal soft reload / SW reset) brings the tabs back, while a
       brand-new visit starts fresh. The engine wipes fateBootResume before we
       run, so we never key off it — saved tabs are the signal. */
    let saved = null;
    try { saved = JSON.parse(sessionStorage.fateBrowserTabs || 'null'); } catch(e){}
    let qp = null;
    try { qp = new URLSearchParams(location.search).get('open'); } catch(e){}

    if (saved && saved.urls && saved.urls.length){
      saved.urls.forEach((u, i) => {
        const t = fbNewTab(null);
        t.pendingUrl = u; t.url = u;
        fbSetTitle(t, fbTitleFor(u));
        fbConnectShow(t, 'restoring ' + fbTitleFor(u) + ' after reload\u2026');
        if (i === (saved.active || 0)) fbActivate(t.id);
      });
      if (qp) fbNewTab(fbNormalize(qp) ? qp : null);
    } else {
      fbNewTab(qp ? qp : null);
    }

    fbGet('fbNewTabBtn').addEventListener('click', () => fbNewTab(null));
    fbGet('fbBackBtn').addEventListener('click', fbBack);
    fbGet('fbFwdBtn').addEventListener('click', fbForward);
    fbGet('fbRelBtn').addEventListener('click', fbReload);
    fbGet('fbHomeBtn').addEventListener('click', fbHome);
    fbGet('fbGoBtn').addEventListener('click', () => fbGo(fbGet('fbAddr').value));
    fbGet('fbPopBtn').addEventListener('click', fbPopout);
    const addr = fbGet('fbAddr');
    addr.addEventListener('keydown', e => { if (e.key === 'Enter') fbGo(addr.value); });
    addr.addEventListener('focus', () => addr.select());
    fbBindKeys();

    fbPaintChip();
    setInterval(fbTick, 600);

    /* auto-boot the tunnel: a browser page should be ready when the user types */
    setTimeout(() => {
      try { if (typeof FATE_JET_STATE !== 'undefined' && FATE_JET_STATE === 'idle') fateJetBoot(); } catch(e){}
    }, 400);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
/* ===== END FATE BROWSER ENGINE ===== */
