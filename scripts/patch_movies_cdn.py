#!/usr/bin/env python3
"""FATE movies.html 2.5 patch — remove wisp/TMDB data lanes, pure Cinemeta CDN."""
import sys, io

P = '/home/z/my-project/download/site/movies.html'
src = open(P, encoding='utf-8').read()
orig_len = len(src)

def find1(s, marker, ctx=''):
    n = s.count(marker)
    if n != 1:
        print('FAIL: marker count=%d for %r %s' % (n, marker[:60], ctx))
        sys.exit(1)
    return s.index(marker)

def cut(s, start_marker, end_marker, replacement, ctx=''):
    """Replace [start of start_marker, start of end_marker) with replacement."""
    i = find1(s, start_marker, ctx + '/start')
    j = find1(s, end_marker, ctx + '/end')
    if j < i:
        print('FAIL: end before start for', ctx)
        sys.exit(1)
    return s[:i] + replacement + s[j:]

# ---- 1. wisp HTTP helpers + laneOrder/laneName + tmdb/tmdbDirect/tmdbWisp → gone
src = cut(src,
    "/* ---- raw HTTP/1.1 GET over the wisp tunnel ---- */",
    "function tmdbLaneCycle(){",
    "", ctx='wisp-http-helpers')

# ---- 2. tmdbLaneCycle → simple reconnect
src = cut(src,
    "function tmdbLaneCycle(){",
    "/* ---- list mapping ---- */",
    """function tmdbLaneCycle(){
  if (liveOK){ renderGenrePills(); backToBrowse(); toast('Catalog CDN reconnected'); }
  else initLive();
}
""", ctx='tmdbLaneCycle')

# ---- 3. tmToMeta/tmCatPath/liveLoadPage → thin delegate to cineLoadPage
src = cut(src,
    "/* ---- list mapping ---- */",
    "function liveEmpty(fail){",
    """/* ---- live grid paging (Cinemeta CDN only) ---- */
function liveLoadPage(){ cineLoadPage(); }
""", ctx='list-mapping')

# ---- 4. openLive tail → always the CDN detail flow
src = cut(src,
    "  if (m.src === 'cine'){ cineDetailFlow(m); return; }",
    "function liveDetailFill(m, d){",
    """  cineDetailFlow(m);   /* CDN lane: cast, runtime, episodes, moviedb_id, sim row */
}
""", ctx='openLive-tail')

# ---- 5. liveDetailFill/liveCert/liveSimRow/liveSeasonPicker/liveLoadEpisodes → gone
src = cut(src,
    "function liveDetailFill(m, d){",
    "function playEpisode(s, e){",
    "", ctx='tmdb-detail-fns')

# ---- 6. boot block: laneUp/refreshTMDBGenres/cineProbe/tmdbProbe/initLive/tmdbTest
NEW_BOOT = """/* ---- live boot: pure Cinemeta CDN — no wisp, no fallback circus ---- */
function laneUp(){
  liveOK = true; liveMode = true; liveLane = 'cine'; cat = 'top';
  setNet('ok', 'Catalog CDN · ' + (cineLast || 'direct'));
  renderGenrePills();
  backToBrowse();
}
function cineProbe(){
  return cineGet('/catalog/movie/top/skip=0.json').then(function(d){
    if (!d || !d.metas || !d.metas.length) throw new Error('empty');
  });
}
function initLive(){
  setNet('wait', 'Catalog CDN: connecting…');
  cineProbe().then(laneUp).catch(function(){
    liveOK = false; liveMode = false;
    setNet('bad', 'Catalog CDN unreachable — vault mode · tap chip to retry');
  });
}
function tmdbTest(){
  var el = $('tmdbLaneInfo');
  if (el) el.textContent = 'Probing the Cinemeta CDN host chain…';
  var t0 = Date.now();
  try { localStorage.removeItem(LS_TM.LANE); cineSticky = null; } catch(e){}
  cineGet('/catalog/movie/top/skip=0.json').then(function(d){
    liveOK = true; liveMode = true; liveLane = 'cine';
    var ms = Date.now() - t0;
    var n = (d && d.metas && d.metas.length) || 0;
    if (el) el.textContent = 'Catalog CDN OK in ' + ms + 'ms via ' + (cineLast || 'direct') +
      ' — ' + n + ' titles on page one. Catalog, search, episodes & posters all ride this one CDN.';
    renderGenrePills(); backToBrowse();
  }).catch(function(){
    if (el) el.textContent = 'Cinemeta hosts unreachable right now — vault mode holds the offline catalog, streams are unaffected. Hit Test again later.';
  });
}

"""
src = cut(src,
    "/* ---- live boot: CINE fast lane first, TMDB direct second, wisp last ---- */",
    "/* ================================================================\n   SITES VAULT",
    NEW_BOOT, ctx='boot-block')

# re-add the SITES VAULT header that cut consumed the start of
src = src.replace("   SITES VAULT — confirmed sources + wisp-tested sites + lane prober",
                  "/* ================================================================\n   SITES VAULT — confirmed sources + wisp-tested sites + lane prober", 1)

# ---- 7. LANES + wisp client (W_F..WConn) → gone
src = cut(src,
    "/* fastest lanes from the Nov 8 scan (ms to first HTTP byte) */",
    "/* ---- vault UI ---- */",
    "", ctx='lanes-wconn')

# ---- 8. renderVault laneRow block → gone
src = cut(src,
    "\n  $('laneRow').innerHTML = LANES.map(function(l, i){",
    "\n  var m = getMarks();\n  Object.keys(m).forEach(function(h){ applyMark(h, m[h]); });",
    "", ctx='renderVault-laneRow')

# ---- 9. openSites status text (exact single-occurrence replace)
OLD_ST = "  if (ti && liveOK) ti.textContent = 'Status: live via the ' + (liveLane === 'cine' ? 'CINEMETA fast lane (no TMDB needed)' : liveLane === 'direct' ? 'TMDB DIRECT lane' : 'WISP TUNNEL') + '. Hit Test to re-probe all three; the winner is saved on this device.';"
NEW_ST = "  if (ti && liveOK) ti.textContent = 'Status: live via the Cinemeta CDN (' + (cineLast || 'direct host') + ') — no wisp, no keys. Hit Test to re-probe the host chain.';"
if src.count(OLD_ST) != 1:
    print('FAIL: openSites status marker count=%d' % src.count(OLD_ST)); sys.exit(1)
src = src.replace(OLD_ST, NEW_ST, 1)

# ---- 10. probeOne/probeLanes → gone
src = cut(src,
    "/* ---- live lane prober (plain HTTP via the wisp tunnel) ---- */",
    "/* ---------- boot (every step guarded) ---------- */",
    "", ctx='lane-prober')

open(P, 'w', encoding='utf-8').write(src)
print('OK: %d -> %d bytes (-%d)' % (orig_len, len(src), orig_len - len(src)))
