#!/usr/bin/env python3
"""Build the NEW games.html: portal games-page look (with cloud games), Apps section removed,
arcade grid fed by the jsDelivr-only vault catalog (fate-games-cat.js v3, 22,727 games).
Every edit is marker-based; the script hard-fails if any marker is not found exactly once."""
import re, sys

SRC = '/home/z/my-project/download/v8.2-deploy/test.html'
DST = '/home/z/my-project/download/v8.2-deploy/games.html'
html = open(SRC, encoding='utf-8').read()

def cut(marker, keep_left=True, name='marker'):
    """assert marker present exactly once; return index span"""
    n = html.count(marker)
    assert n == 1, f'{name}: found {n}x (expected 1): {marker[:70]!r}'
    i = html.index(marker)
    return i, i + len(marker)

def replace_once(old, new, name):
    global html
    n = html.count(old)
    assert n == 1, f'{name}: found {n}x (expected 1): {old[:70]!r}'
    html = html.replace(old, new)
    print(f'  ok: {name}')

# ---------- 1. load vault catalog next to pass.js ----------
replace_once(
    '<script src="pass.js"></script>',
    '<script src="pass.js"></script>\n<script src="fate-games-cat.js" defer></script>',
    'vault script tag')

# ---------- 2. remove the Apps quick-action button ----------
replace_once(
    """    <button class="q-btn" onclick="fateToggleApps()" title="Open proxied apps (A)">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
      Apps
    </button>
""",
    '',
    'remove Apps q-btn')

# ---------- 3. pills: All/Arcade/Emulator/Flash (kind filters) ----------
replace_once(
    """    <button class="pill" data-filter="hot" onclick="setFilter('hot')">Hot</button>
    <button class="pill" data-filter="new" onclick="setFilter('new')">New</button>
    <button class="pill" data-filter="exp" onclick="setFilter('exp')">Experimental</button>""",
    """    <button class="pill" data-filter="arcade" onclick="setFilter('arcade')">Arcade</button>
    <button class="pill" data-filter="emulator" onclick="setFilter('emulator')">Emulator</button>
    <button class="pill" data-filter="flash" onclick="setFilter('flash')">Flash</button>""",
    'pills -> kinds')

# ---------- 4. applyFilters: kind-based filter ----------
replace_once(
    '    list = list.filter(g => g[activeFilter] === true);',
    "    list = list.filter(g => (g.kind || 'arcade') === activeFilter);",
    'applyFilters kind')

# ---------- 5. keyboard: drop the A shortcut ----------
replace_once("      case 'a': case 'A': fateToggleApps(); break;\n", '', 'keyboard A shortcut')

# ---------- 6. catalog: replace CDN_SOURCES + init() with vault loader ----------
start, end = cut('const GH_EDGES', name='catalog span start')
end2 = html.index('function getGameImage(g){')
assert start < end2 < end + 100000
old_catalog = html[start:end2]
assert 'async function init(){' in old_catalog and 'CDN_SOURCES' in old_catalog

new_catalog = """/* ============================================
   FATE VAULT - 22,727 jsDelivr-ONLY games (catalog v3)
   Every URL lives on *.jsdelivr.net/gh (raw/githack links were rewritten,
   dead ones probed out at build time). Decoded from fate-games-cat.js
   (gzip+base64, the same technique Storm0S uses) in ~0.1s.
   ============================================ */
async function decodeVault(){
  const b64 = window.FATE_GAMES_B64;
  if(!b64 || !b64.length) throw new Error('fate-games-cat.js missing next to this page');
  if(typeof DecompressionStream === 'undefined') throw new Error('browser too old - update iOS/Safari (needs 16.4+)');
  const parts = [];
  for(let i = 0; i < b64.length; i += 65536){
    const s = atob(b64.slice(i, i + 65536));
    const u = new Uint8Array(s.length);
    for(let j = 0; j < s.length; j++) u[j] = s.charCodeAt(j);
    parts.push(u);
  }
  const buf = await new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return JSON.parse(new TextDecoder().decode(buf));
}

async function init(){
  loadStorage();
  initParticles();
  initMouseGlow();
  initKeyboard();
  initImageObserver();
  initInfiniteScroll();
  setupIframeHandlers();
  loadSettings();
  renderRecent();

  let vault = [];
  try{
    const t0 = performance.now();
    const raw = await decodeVault();
    vault = raw.map((e, i) => ({
      id: 'v3_' + i,
      name: e.n || 'Untitled',
      url: e.u,
      image: e.i || '',
      kind: e.k || 'arcade',
      top: false, new: false, exp: false, updated: false, cloud: false
    })).filter(g => g.url);
    console.log('[FATE VAULT] ' + vault.length + ' jsDelivr games decoded in ' + Math.round(performance.now() - t0) + 'ms');
  }catch(e){
    console.warn('[FATE VAULT] decode failed:', e.message);
  }

  // Stratus cloud-streaming games (real cloud gaming) - NON-BLOCKING:
  // the vault grid renders immediately; cloud games merge in the moment
  // the mirror sweep answers (a dead CDN can no longer stall it)
  (async () => {
    const cloudGames = await fetchStratusGames(false);
    if (cloudGames.length) {
      allGames = allGames.concat(cloudGames.filter(g => !allGames.some(x => x.id === g.id)));
      console.log('[FATE CDN] stratus: ' + cloudGames.length + ' cloud games');
      applyFilters();
    }
    scheduleCloudRetry();
  })();

  // Deduplicate (same policy as the portal: URL-level + name-level)
  const seenUrls = new Set();
  const seenNames = new Set();
  allGames = vault.filter(g => {
    if (!g.url || g.url === '#') return false;
    if (seenUrls.has(g.url)) return false;
    seenUrls.add(g.url);
    const normName = (g.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenNames.has(normName)) return false;
    seenNames.add(normName);
    return true;
  });

  console.log('%c[FATE V5] Loaded ' + allGames.length + ' games', 'color:#f59e0b;font-weight:bold;');
  $('skeletonGrid').style.display = 'none';
  applyFilters();
}

"""
html = html[:start] + new_catalog + html[end2:]
print('  ok: catalog span replaced (' + str(len(old_catalog)) + ' chars -> vault loader)')

# ---------- 7. fateJetEnsureUI: drop apps modal, keep browse view ----------
replace_once(
    "  if (document.getElementById('fateAppsModal')) return;",
    "  if (document.getElementById('fateBrowseView')) return;",
    'ensureUI guard -> browse view')

s, e = cut('  const modal = document.createElement(\'div\');', name='apps modal start')
e2 = html.index("  modal.addEventListener('click', e => { if (e.target === modal) fateToggleApps(false); });", s)
e2 = html.index('\n', e2) + 1
html = html[:s] + '' + html[e2:]
print('  ok: apps modal block removed')

# ---------- 8. fateToggleApps -> jet preboot (no modal) ----------
replace_once(
    """function fateToggleApps(force){
  fateJetEnsureUI();
  const m = document.getElementById('fateAppsModal');
  const open = force !== undefined ? force : !m.classList.contains('open');
  m.classList.toggle('open', open);
  if (open){ fateJetPaintStatus(); if (FATE_JET_STATE !== 'ready') fateJetBoot(); }
}""",
    """function fateJetPreboot(){
  fateJetEnsureUI();
  fateJetPaintStatus();
  if (FATE_JET_STATE !== 'ready') fateJetBoot();
}""",
    'fateToggleApps -> fateJetPreboot')

replace_once('    fateToggleApps(true);', '    fateJetPreboot();', 'browse preboot call')

# ---------- 9. final assertions ----------
for gone in ('fateToggleApps', 'fateAppsModal', 'CDN_SOURCES', 'resolveSourceUrl', 'ckvUgsTransform', "data-filter=\"hot\""):
    n = html.count(gone)
    assert n == 0, f'leftover {gone!r}: {n} refs'
for must in ('decodeVault', 'fate-games-cat.js', 'fateJetPreboot', 'fetchStratusGames', 'cloudSection',
             'tiktokSection', 'fateBrowseOpen', 'cloudToggle', 'cdnPicker', 'keysBar', 'FATE_JET_APPS'):
    n = html.count(must)
    assert n > 0, f'missing required {must!r}'
print('  ok: assertions passed')

open(DST, 'w', encoding='utf-8').write(html)
print(f'written {DST} ({len(html)} bytes)')
