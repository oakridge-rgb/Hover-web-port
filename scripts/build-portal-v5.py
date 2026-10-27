#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-portal-v5.py — FATE PORTAL v5 "smart player"
Base: download/test-v4-arcade-network.html (v4 arcade network + v3 cloud stack)
Out:  download/test-v5-smart-player.html

v5 adds:
  1. SMART PLAYER LANE: jsDelivr serves every GitHub-hosted .html as text/plain
     (~2400 games in ckv/ugs/seraph/gnm) so plain iframes/new tabs show raw code.
     Fix = fetch the source (jsDelivr sends ACAO:*), patch it, re-serve as a
     text/html blob into the sandboxed iframe. Validated live on FNF Bob v2.0.
  2. buildPlayableHtml(): injects <base> when missing + guards the OpenFL
     "getElementById('viewport') -> null" landmine that throws on dpr>2 devices.
  3. On-screen touch KEYS bar (ESC/ENTER/SPACE/arrows/WASD/R) dispatching
     synthetic KeyboardEvents into the game iframe — validated live (FNF
     warning screen dismissed). Auto-opens on touch devices.
  4. New-tab button uses the same fetch+blob pipeline (about:blank then blob).
  5. Edge-fallback fetch chain (cdn/gcore/testingcf/fastly/originfastly),
     20s timeout, honest legacy-src fallback when the lane can't fetch.
  6. Blob URL revocation on close/relaunch; loader hint about long black
     loading phases; updated CDN picker note; build stamps bumped to v5.
"""
import io, os, re, sys

SRC = "/home/z/my-project/download/test-v4-arcade-network.html"
OUT = "/home/z/my-project/download/test-v5-smart-player.html"
BUILD = "v5 (2026-10-27)"

with io.open(SRC, "r", encoding="utf-8") as f:
    t = f.read()

def rep(old, new, count=1, label=""):
    global t
    n = t.count(old)
    assert n == count, "anchor [%s] found %d times (expected %d):\n%r" % (label or old[:60], n, count, old[:120])
    t = t.replace(old, new)
    print("ok  %s" % (label or (old[:70] + "...")))

# ------------------------------------------------------------------
# 1) Build stamps -> v5
# ------------------------------------------------------------------
rep("<!-- FATE PORTAL BUILD v4 (2026-10-27) : arcade GitHub network (ckv+ugs+seraph+gn-math via jsDelivr multi-edge) + full v3 cloud stack -->",
    "<!-- FATE PORTAL BUILD v5 (@BUILD@) : smart player (fetch+blob defeats jsDelivr text/plain for GitHub games) + on-screen touch keys + arcade GitHub network + full v3 cloud stack -->",
    label="head build comment")

rep("[FATE PORTAL v4]", "[FATE PORTAL v5]", count=3, label="console markers v4->v5")

rep("cloud build v4 — arcade network live + 27-lane sweep + self-test",
    "cloud build v5 — smart player + touch keys + arcade network + 27-lane sweep",
    label="footer chip")

# ------------------------------------------------------------------
# 2) CDN picker note: text/plain is now auto-fixed
# ------------------------------------------------------------------
rep("""    <p class="cdn-picker-sub">Choose which server loads this game. <b style="color:#10b981;">Green</b> = reachable, <b style="color:#ef4444;">red</b> = blocked. Note: jsDelivr edges ping green but serve .html as raw code (content-type issue, not a block). Use <b>Test All</b> to check every CDN on your network.</p>""",
    """    <p class="cdn-picker-sub">Choose which server loads this game from. <b style="color:#10b981;">Green</b> = reachable, <b style="color:#ef4444;">red</b> = blocked. jsDelivr serves GitHub .html as raw text — the v5 smart player auto-converts it to a playable page, so green CDNs play for real now. Use <b>Test All</b> to check reachability on your network.</p>""",
    label="cdn picker note")

# ------------------------------------------------------------------
# 3) Loader hint: long black loading phases are the game, not a bug
# ------------------------------------------------------------------
rep("""        <p style="color:var(--text-muted);font-size:.9rem;">Loading game...</p>""",
    """        <p style="color:var(--text-muted);font-size:.9rem;">Loading game...</p>
        <p style="color:#64748b;font-size:.72rem;max-width:340px;text-align:center;line-height:1.5;">Big games (FNF mods and similar) can sit on a black screen for a minute while they load — that's the game, not a bug. No keyboard? Tap the key icon in the header for on-screen keys.</p>""",
    label="loader hint")

# ------------------------------------------------------------------
# 4) Keys toggle button in the player header (before newTabBtn)
# ------------------------------------------------------------------
rep("""      <div class="popup-actions">
        <button class="popup-btn" id="newTabBtn" onclick="openGameInNewTab()" title="Open in New Tab">""",
    """      <div class="popup-actions">
        <button class="popup-btn" id="keysBtn" onclick="toggleKeysBar()" title="On-screen keys (touch)">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-3zM8 8h2v2H8V8zm0 3h2v2H8v-3zm-1 2H5V8h2v5zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>
        </button>
        <button class="popup-btn" id="newTabBtn" onclick="openGameInNewTab()" title="Open in New Tab">""",
    label="keys button in header")

# ------------------------------------------------------------------
# 5) Keys bar markup (top of the play area) + CSS
# ------------------------------------------------------------------
rep("""    <div class="popup-content">
      <div id="gameLoader" """,
    """    <div class="popup-content">
      <div id="keysBar" style="display:none;"></div>
      <div id="gameLoader" """,
    label="keysBar markup")

rep(""".popup-content iframe{width:100%;height:100%;border:none}""",
    """.popup-content iframe{width:100%;height:100%;border:none}
#keysBar{position:absolute;top:0;left:0;right:0;z-index:4;display:none;flex-wrap:wrap;gap:6px;padding:8px 10px 6px;background:rgba(2,6,23,.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);justify-content:center;user-select:none;-webkit-user-select:none;}
#keysBar button{min-width:46px;height:38px;padding:0 10px;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.92);color:#e2e8f0;font:600 14px/1 system-ui,-apple-system,sans-serif;touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer;}
#keysBar button:active,#keysBar button.held{background:var(--primary,#f59e0b);color:#0b1020;}
#keysBar .kb-hint{width:100%;text-align:center;color:#94a3b8;font-size:.66rem;line-height:1.3;padding-top:2px;}""",
    label="keysBar css")

# ------------------------------------------------------------------
# 6) Smart-player JS core (inserted before the launch section)
# ------------------------------------------------------------------
CORE = r"""/* ===== v5 SMART PLAYER (fetch+blob lane + on-screen keys) =====
   jsDelivr serves every GitHub-hosted .html as text/plain, so direct
   iframes/new tabs show raw code. We fetch the source (ACAO:*), patch it,
   and re-serve it as a real text/html blob. Validated on FNF Bob v2.0. */
console.log('[FATE PORTAL v5] smart player ready - fetch+blob lane for GitHub games (text/plain fix) + on-screen keys');

function isGhFamilyUrl(u){
  return !!u && /^https:\/\/([a-z0-9-]+\.jsdelivr\.net\/gh\/|cdn\.statically\.io\/gh\/|raw\.githack\.com\/|gh-proxy\.com\/)/i.test(u);
}

function buildPlayableHtml(rawHtml, gameUrl){
  let html = rawHtml;
  // Guard the OpenFL landmine: pages that do getElementById("viewport")
  // without defining it throw on dpr>2 devices and can kill boot scripts.
  const needsVp = /getElementById\s*\(\s*["']viewport["']\s*\)/.test(html) && !/<meta[^>]+id=["']?viewport/i.test(html);
  const hasBase = /<base\s/i.test(html);
  const dir = gameUrl.replace(/[^\/]*$/, '');
  let inject = '';
  if(needsVp) inject += '<meta id="viewport" name="viewport" content="width=device-width, initial-scale=1">';
  if(!hasBase) inject += '<base href="' + dir + '">';
  if(inject){
    if(/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, m => m + inject);
    else html = inject + html;
  }
  return html;
}

function ghEdgeCandidates(u){
  const list = [u];
  const m = u.match(/^https:\/\/[a-z0-9-]+\.jsdelivr\.net\/gh\/(.+)$/i);
  if(m){
    ['cdn','gcore','testingcf','fastly','originfastly'].forEach(e => {
      const cand = 'https://' + e + '.jsdelivr.net/gh/' + m[1];
      if(list.indexOf(cand) === -1) list.push(cand);
    });
  }
  return list;
}

async function fetchPlayable(url){
  const cands = ghEdgeCandidates(url);
  for(let i = 0; i < cands.length; i++){
    try{
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(cands[i], { cache: 'no-store', signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(to);
      if(!res.ok) continue;
      const text = await res.text();
      if(!text || text.length < 30) continue;
      // UGS files have a "<Module> / <!-- comment -->" preamble before the
      // real HTML, so accept anything that CONTAINS html structure near the
      // top instead of requiring the first token to be a tag.
      if(!/(<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>])/i.test(text.slice(0, 4000))) continue;
      return { ok: true, html: buildPlayableHtml(text, cands[i]), finalUrl: cands[i] };
    }catch(e){ /* try next edge */ }
  }
  return { ok: false };
}

function revokeFrameBlob(frame){
  if(frame && frame._blobUrl){
    try{ URL.revokeObjectURL(frame._blobUrl); }catch(e){}
    frame._blobUrl = null;
  }
}

/* --- on-screen keys: synthetic KeyboardEvents into the game iframe --- */
const KEYS_BAR = [
  { l:'ESC',   key:'Escape',     code:'Escape',     kc:27 },
  { l:'ENTER', key:'Enter',      code:'Enter',      kc:13 },
  { l:'SPACE', key:' ',          code:'Space',      kc:32 },
  { l:'\u2191', key:'ArrowUp',    code:'ArrowUp',    kc:38 },
  { l:'\u2193', key:'ArrowDown',  code:'ArrowDown',  kc:40 },
  { l:'\u2190', key:'ArrowLeft',  code:'ArrowLeft',  kc:37 },
  { l:'\u2192', key:'ArrowRight', code:'ArrowRight', kc:39 },
  { l:'W', key:'w', code:'KeyW', kc:87 },
  { l:'A', key:'a', code:'KeyA', kc:65 },
  { l:'S', key:'s', code:'KeyS', kc:83 },
  { l:'D', key:'d', code:'KeyD', kc:68 },
  { l:'R', key:'r', code:'KeyR', kc:82 }
];

function gameKeyEv(def, down){
  const f = $('gameFrame');
  if(!f || !def) return;
  try{
    const w = f.contentWindow, d = w.document;
    if(!w || !d) return;
    d.dispatchEvent(new w.KeyboardEvent(down ? 'keydown' : 'keyup', {
      key: def.key, code: def.code, keyCode: def.kc, which: def.kc, bubbles: true, cancelable: true
    }));
  }catch(e){}
}

function toggleKeysBar(force){
  const bar = $('keysBar');
  if(!bar) return;
  const show = (force === undefined) ? (bar.style.display !== 'flex') : !!force;
  bar.style.display = show ? 'flex' : 'none';
}

(function buildKeysBar(){
  const bar = $('keysBar');
  if(!bar) return;
  bar.innerHTML = KEYS_BAR.map(k => '<button data-kc="' + k.kc + '">' + k.l + '</button>').join('') +
    '<span class="kb-hint">hold = key stays down \u00b7 tap the key icon to hide</span>';
  const btns = bar.querySelectorAll('button');
  for(const btn of btns){
    const def = KEYS_BAR.find(k => String(k.kc) === btn.getAttribute('data-kc'));
    const dn = e => { e.preventDefault(); gameKeyEv(def, true); btn.classList.add('held'); };
    const up = e => { e.preventDefault(); gameKeyEv(def, false); btn.classList.remove('held'); };
    btn.addEventListener('pointerdown', dn);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }
})();

/* ===== GAME LAUNCH (via chosen CDN) ===== */"""

rep("/* ===== GAME LAUNCH (via chosen CDN) ===== */", CORE, label="smart player core")

# ------------------------------------------------------------------
# 7) launchGame -> smart lane with legacy fallback
# ------------------------------------------------------------------
rep("""function launchGame(providerId){
  const p = CDN_PROVIDERS.find(x => x.id === providerId) || CDN_PROVIDERS[0];
  $('cdnBtnLabel').textContent = p.name.split('·')[0].trim();
  $('gamePopup').classList.add('open');
  $('gameLoader').style.display = 'flex';
  $('gameError').style.display = 'none';
  $('gameFrame').style.opacity = '0';

  const frame = $('gameFrame');
  if(frame._loadTimeout) clearTimeout(frame._loadTimeout);
  frame.src = 'about:blank';

  setTimeout(() => {
    frame.src = getGameUrlByProvider(currentGame, providerId);
    frame._loadTimeout = setTimeout(() => {
      if($('gameLoader').style.display !== 'none') showGameError();
    }, 10000);
  }, 100);
}""",
"""function legacyLaunch(url){
  const frame = $('gameFrame');
  frame.src = 'about:blank';
  setTimeout(() => {
    frame.src = url;
    frame._loadTimeout = setTimeout(() => {
      if($('gameLoader').style.display !== 'none') showGameError();
    }, 10000);
  }, 100);
}

async function launchGame(providerId){
  const p = CDN_PROVIDERS.find(x => x.id === providerId) || CDN_PROVIDERS[0];
  $('cdnBtnLabel').textContent = p.name.split('·')[0].trim();
  $('gamePopup').classList.add('open');
  $('gameLoader').style.display = 'flex';
  $('gameError').style.display = 'none';
  const frame = $('gameFrame');
  frame.style.opacity = '0';
  revokeFrameBlob(frame);
  if(frame._loadTimeout) clearTimeout(frame._loadTimeout);

  const target = getGameUrlByProvider(currentGame, providerId);
  if(!isGhFamilyUrl(target) || !window.fetch){ legacyLaunch(target); return; }

  frame.src = 'about:blank';
  frame._loadTimeout = setTimeout(() => {
    if($('gameLoader').style.display !== 'none') showGameError();
  }, 25000);

  const r = await fetchPlayable(target);
  if(!currentGame || !$('gamePopup').classList.contains('open')) return; // closed meanwhile
  if(r.ok){
    clearTimeout(frame._loadTimeout);
    frame._blobUrl = URL.createObjectURL(new Blob([r.html], { type: 'text/html' }));
    $('gameLoader').style.display = 'none';
    $('gameError').style.display = 'none';
    frame.style.opacity = '1';
    frame.src = frame._blobUrl;
    console.log('[FATE PORTAL v5] smart lane: ' + r.finalUrl);
  }else{
    console.warn('[FATE PORTAL v5] smart lane failed on every edge - falling back to direct src');
    legacyLaunch(target);
  }
}""",
    label="launchGame smart lane")

# ------------------------------------------------------------------
# 8) openGameInNewTab -> blob pipeline for GitHub games
# ------------------------------------------------------------------
rep("""function openGameInNewTab(){
  if(currentGame && currentGame.url && currentGame.url.indexOf('stratus://') === 0) return;
  if(currentGame){
    const u = getGameUrl(currentGame);
    if(u && u !== '#') window.open(u, '_blank');
  }
}""",
"""async function openGameInNewTab(){
  if(!currentGame) return;
  if(currentGame.url && currentGame.url.indexOf('stratus://') === 0) return;
  const target = getGameUrlByProvider(currentGame, getCdnPref() || 'direct');
  if(!isGhFamilyUrl(target) || !window.fetch){
    const u = currentGame.url;
    if(u && u !== '#') window.open(u, '_blank');
    return;
  }
  // open a real tab synchronously (keeps the user gesture), fill it after fetch
  const w = window.open('about:blank', '_blank');
  if(!w){ alert('Allow popups for this site to open games in a new tab.'); return; }
  try{
    w.document.write('<p style="font-family:monospace;color:#94a3b8;background:#0b1020;height:100%;">loading game...</p>');
  }catch(e){}
  const r = await fetchPlayable(target);
  try{
    if(r.ok){
      w.location.href = URL.createObjectURL(new Blob([r.html], { type: 'text/html' }));
    }else{
      w.location.href = target;
    }
  }catch(e){ /* user closed the tab */ }
}""",
    label="openGameInNewTab blob pipeline")

# ------------------------------------------------------------------
# 9) closePopup -> revoke blob
# ------------------------------------------------------------------
rep("""function closePopup(){
  stopCloudIfActive();
  $('gamePopup').classList.remove('open');
  const frame = $('gameFrame');
  if(frame._loadTimeout) clearTimeout(frame._loadTimeout);
  frame.src = 'about:blank';""",
"""function closePopup(){
  stopCloudIfActive();
  $('gamePopup').classList.remove('open');
  const frame = $('gameFrame');
  if(frame._loadTimeout) clearTimeout(frame._loadTimeout);
  revokeFrameBlob(frame);
  frame.src = 'about:blank';""",
    label="closePopup blob revoke")

# ------------------------------------------------------------------
# 10) openGame -> auto-show keys bar on touch devices
# ------------------------------------------------------------------
rep("""  $('cdnBtn').style.display = '';
  $('newTabBtn').style.display = '';

  // Real cloud-streaming games skip the iframe + CDN picker entirely""",
"""  $('cdnBtn').style.display = '';
  $('newTabBtn').style.display = '';
  toggleKeysBar(('ontouchstart' in window) || ((navigator.maxTouchPoints || 0) > 0));

  // Real cloud-streaming games skip the iframe + CDN picker entirely""",
    label="auto keys bar on touch")

# ------------------------------------------------------------------
# finalize
# ------------------------------------------------------------------
t = t.replace("@BUILD@", BUILD)

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(t)

print("\nwrote %s (%d bytes, build %s)" % (OUT, len(t.encode('utf-8')), BUILD))
