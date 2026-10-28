#!/usr/bin/env python3
# build-portal-v7.py — v6 -> v7 "tiktok feed" upgrade
# Adds: FATE-styled TikTok page (vertical snap feed) fed by tikwm via 4 lanes
#       (direct / allorigins / codetabs / wisp-tunnel), region picker, search,
#       blob fallback for blocked video CDNs, 'T' hotkey, v7 stamps.
# Run:  python3 scripts/build-portal-v7.py
import re, sys

SRC = "/home/z/my-project/download/test-v6-wisp-lane.html"
DST = "/home/z/my-project/download/test-v7-tiktok-feed.html"
ENGINE = open("/home/z/my-project/scripts/tt-engine.js", encoding="utf-8").read()

html = open(SRC, encoding="utf-8").read()
orig_len = len(html)

def must_replace(old, new, label):
    global html
    if old not in html:
        print(f"FAIL: anchor not found for [{label}]")
        sys.exit(1)
    if html.count(old) != 1:
        print(f"FAIL: anchor not unique for [{label}] ({html.count(old)} hits)")
        sys.exit(1)
    html = html.replace(old, new)
    print(f"ok: {label}")

# ------------------------------------------------------------------ styles + section
TT_STYLE = r"""
/* ===== FATE V7 TIKTOK STYLES ===== */
.tt-shell{max-width:560px;margin:0 auto;}
.tt-head{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin-bottom:.8rem;}
.tt-head h3{display:flex;align-items:center;gap:.5rem;font-size:1.15rem;font-weight:800;color:#fff;margin:0;}
.tt-logo{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#fe2c55,#25f4ee 90%);box-shadow:0 0 18px rgba(254,44,85,.35);}
.tt-chip{font-size:.72rem;font-weight:700;padding:.3rem .7rem;border-radius:999px;background:rgba(0,0,0,.4);border:1px solid rgba(148,163,184,.3);color:#94a3b8;}
.tt-btn{display:inline-flex;align-items:center;gap:.4rem;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.45);color:#fcd34d;font-size:.78rem;font-weight:600;padding:.4rem .85rem;border-radius:999px;cursor:pointer;transition:background .2s,transform .1s;}
.tt-btn:hover{background:rgba(245,158,11,.25);}
.tt-btn:active{transform:scale(.96);}
.tt-btn-cyan{background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.4);color:#67e8f9;}
.tt-btn-cyan:hover{background:rgba(34,211,238,.22);}
.tt-searchrow{display:flex;gap:.5rem;margin-bottom:.7rem;}
.tt-search{flex:1;background:rgba(0,0,0,.45);border:1px solid rgba(148,163,184,.3);border-radius:12px;padding:.6rem .9rem;color:#e2e8f0;font-size:.9rem;outline:none;}
.tt-search:focus{border-color:rgba(245,158,11,.55);box-shadow:0 0 0 3px rgba(245,158,11,.12);}
.tt-regions{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.9rem;}
.tt-region{background:rgba(0,0,0,.4);border:1px solid rgba(148,163,184,.3);color:#94a3b8;font-size:.72rem;font-weight:700;padding:.3rem .7rem;border-radius:999px;cursor:pointer;transition:all .2s;}
.tt-region:hover{color:#fff;border-color:rgba(245,158,11,.5);}
.tt-region.active{background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.6);color:#fcd34d;}
.tt-feed{height:calc(100vh - 240px);min-height:420px;overflow-y:scroll;scroll-snap-type:y mandatory;border-radius:18px;border:1px solid rgba(148,163,184,.2);background:rgba(0,0,0,.55);overscroll-behavior:contain;}
.tt-feed::-webkit-scrollbar{width:8px;}
.tt-feed::-webkit-scrollbar-thumb{background:rgba(245,158,11,.35);border-radius:8px;}
.tt-card{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;padding:10px;}
.tt-stage{position:relative;width:100%;max-width:430px;height:calc(100% - 8px);border-radius:16px;overflow:hidden;background:#000;border:1px solid rgba(254,44,85,.25);box-shadow:0 0 30px rgba(0,0,0,.6),0 0 12px rgba(254,44,85,.12);}
.tt-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;}
.tt-tap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;}
.tt-playicon{opacity:1;transition:opacity .15s;pointer-events:none;filter:drop-shadow(0 2px 10px rgba(0,0,0,.7));}
.tt-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.15);z-index:4;}
.tt-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#fe2c55,#25f4ee);}
.tt-rail{position:absolute;right:8px;bottom:64px;display:flex;flex-direction:column;gap:14px;z-index:3;}
.tt-rail-item{display:flex;flex-direction:column;align-items:center;gap:2px;}
.tt-rail-item svg{width:26px;height:26px;filter:drop-shadow(0 1px 4px rgba(0,0,0,.8));}
.tt-rail-item span{font-size:.68rem;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9);}
.tt-overlay{position:absolute;left:0;right:56px;bottom:10px;padding:.6rem .8rem;z-index:3;background:linear-gradient(transparent,rgba(0,0,0,.75));border-radius:0 0 16px 16px;pointer-events:none;}
.tt-author{font-weight:800;font-size:.9rem;color:#fff;margin-bottom:.15rem;text-shadow:0 1px 3px rgba(0,0,0,.8);}
.tt-desc{font-size:.8rem;color:rgba(255,255,255,.92);line-height:1.35;max-height:3.6em;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.8);}
.tt-music{display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:#25f4ee;margin-top:.3rem;white-space:nowrap;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.8);}
.tt-music span{overflow:hidden;text-overflow:ellipsis;}
.tt-meta{font-size:.65rem;color:rgba(255,255,255,.55);margin-top:.25rem;}
.tt-mute{position:absolute;top:10px;right:10px;z-index:3;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:999px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.tt-mute.tt-unmuted{background:rgba(254,44,85,.75);border-color:rgba(254,44,85,.9);}
.tt-spinner{width:18px;height:18px;border:2px solid rgba(245,158,11,.3);border-top-color:#fbbf24;border-radius:50%;animation:ttspin .8s linear infinite;}
@keyframes ttspin{to{transform:rotate(360deg);}}
.tt-status{display:flex;align-items:center;gap:.6rem;justify-content:center;padding:.9rem 0;}
.tt-note{font-size:.72rem;color:#94a3b8;margin:.5rem 0 0;line-height:1.5;}
.tt-note b{color:#fcd34d;}
/* ===== END FATE V7 TIKTOK STYLES ===== */
"""

TT_ICON = '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>'

TT_TOGGLE = """    <button class="cloud-toggle" id="tiktokToggle" onclick="toggleTikTokView()" title="TikTok feed (T)">
      <svg viewBox="0 0 24 24" style="fill:#25f4ee;"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
      <span id="tiktokLabel">TikTok</span>
    </button>
"""

TT_REGION_BTNS = "".join(
    f'<button class="tt-region{" active" if r == "US" else ""}" data-region="{r}" onclick="setTikTokRegion(\'{r}\')">{r}</button>'
    for r in ["US", "UK", "DE", "FR", "JP", "BR"]
)

TT_SECTION = f"""<!-- ===== FATE V7 TIKTOK (toggleable section) ===== -->
<style>{TT_STYLE}</style>
<div class="cloud-section" id="tiktokSection" style="display:none;">
  <div class="tt-shell">
    <div class="tt-head">
      <h3><span class="tt-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg></span> FATE TikTok</h3>
      <span class="tt-chip" id="ttStatusChip">idle</span>
      <button class="tt-btn" onclick="reloadTikTok()" title="Refetch the feed through the fastest lane">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        Reload
      </button>
    </div>
    <div class="tt-searchrow">
      <input type="text" class="tt-search" id="ttSearchInput" placeholder="Search TikTok videos…" onkeydown="if(event.key==='Enter')ttDoSearch()" />
      <button class="tt-btn tt-btn-cyan" onclick="ttDoSearch()">Search</button>
      <button class="tt-btn" onclick="ttClearSearch()">Clear</button>
    </div>
    <div class="tt-regions">{TT_REGION_BTNS}</div>
    <div class="tt-feed" id="ttFeed"></div>
    <div class="tt-status" id="ttFeedStatus" style="display:none;"></div>
    <p class="tt-note">Feed via <b>tikwm</b> through 4 lanes (direct → allorigins → codetabs → wisp tunnel). Tap to pause · speaker icon unmutes · scroll for more. Search rides the same lanes; if it is rate-limited the For You feed still works. Press <b>T</b> anytime.</p>
  </div>
</div>
<!-- ===== END FATE V7 TIKTOK ===== -->"""

TT_SCRIPT = "<script>\n" + ENGINE + "\n</script>\n"

# ------------------------------------------------------------------ patches
# 1. TikTok toggle button next to the Cloud toggle
must_replace(
    """    <button class="cloud-toggle" id="cloudToggle" onclick="toggleCloudView()" title="Toggle cloud games (C)">
      <svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
      <span id="cloudLabel">Cloud</span>
    </button>""",
    """    <button class="cloud-toggle" id="cloudToggle" onclick="toggleCloudView()" title="Toggle cloud games (C)">
      <svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
      <span id="cloudLabel">Cloud</span>
    </button>
""" + TT_TOGGLE.rstrip(),
    "tiktok toggle button")

# 2. TikTok section before </main>
must_replace(
    """      <button class="load-more-btn" onclick="loadMore()">Load More Cloud Games</button>
    </div>
  </div>
</main>""",
    """      <button class="load-more-btn" onclick="loadMore()">Load More Cloud Games</button>
    </div>
  </div>
""" + TT_SECTION + "</main>",
    "tiktok section")

# 3. footer stamp v6 -> v7
must_replace(
    'cloud build v6 — wisp lane tunnel + smart player + arcade network',
    'cloud build v7 — tiktok feed + wisp lane tunnel + smart player + arcade network',
    "footer stamp v7")

# 4. keyboard hotkey T
must_replace(
    "      case 'c': case 'C': toggleCloudView(); break;",
    "      case 'c': case 'C': toggleCloudView(); break;\n      case 't': case 'T': toggleTikTokView(); break;",
    "hotkey T")

# 5. cloud view closes tiktok
must_replace(
    "function toggleCloudView(){\n  showCloudOnly = !showCloudOnly;",
    "function toggleCloudView(){\n  if(typeof ttCloseView === 'function') ttCloseView();\n  showCloudOnly = !showCloudOnly;",
    "cloud closes tiktok")

# 6. favorites view closes tiktok
must_replace(
    "function toggleFavoritesView(){\n  showFavoritesOnly = !showFavoritesOnly;",
    "function toggleFavoritesView(){\n  if(typeof ttCloseView === 'function') ttCloseView();\n  showFavoritesOnly = !showFavoritesOnly;",
    "favorites closes tiktok")

# 7. applyFilters must not fight the TikTok view (catalog init re-shows grid)
must_replace(
    "function applyFilters(){\n  let list = allGames;",
    "function applyFilters(){\n  if(typeof showTikTokOnly !== 'undefined' && showTikTokOnly){ if(typeof syncTikTokViewUI === 'function') syncTikTokViewUI(); return; }\n  let list = allGames;",
    "applyFilters tiktok guard")

# 8. engine script before </body>
must_replace(
    "})();\n\n</script>\n</body>",
    "})();\n\n</script>\n" + TT_SCRIPT + "</body>",
    "v7 tiktok engine script")

open(DST, "w", encoding="utf-8").write(html)
print(f"\nbuilt: {DST} ({len(html) / 1024:.1f} KB, src {orig_len / 1024:.1f} KB)")
