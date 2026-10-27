#!/usr/bin/env python3
# build-portal-v82.py — v7 -> v8.2 "jet lane, self-healing boot" upgrade
# Changes vs v8.1 (root-caused "keeps booting and never starts"):
#   - jet handshake retry loop (OFFICIAL recipe): wrap Controller.readyResolve,
#     re-post a FRESH MessageChannel port via setupMessagePort() every 4s (5 tries),
#     then swReset() (unregister all SWs + reload). v8.1 awaited ready with NO
#     timeout -> a missed SW message = infinite "booting".
#   - swAlive probe: the SW must actually ANSWER __sw_alive fetches, not just be active.
#   - swReset recovery: corrupted/stale SWs (e.g. leftover from the v8 CDN-import
#     deploy) are unregistered + the page reloads once, guarded per session.
#   - SW health watcher every 20s + on focus/visibility: dead SW -> swReset,
#     controllerchange -> fresh port (iPad background-tab freeze survival).
#   - pagehide pending-RPC cleanup (zombie-promise guard, official recipe).
#   - boot stage pill: visible progress (sw -> files -> tunnel -> controller -> ready)
#     with "still working..." hint after 8s and tap-to-retry on failure. 75s budget.
#   - fate-sw.js v3: "proxy warming up" auto-refresh CAPPED at 4 tries, then a
#     stuck-screen with Retry (kills the endless meta-refresh loop).
#   - transport init retries while "wasm not loaded" (official recipe).
#   - 15s timeout on script loads; apps grid = exact reference SHORTCUTS (10 tiles,
#     Snapchat -> www.snapchat.com/web, + Geforce Now + Geometry Dash).
import shutil, sys, os

SRC = "/home/z/my-project/download/test-v7-tiktok-feed.html"
DST = "/home/z/my-project/download/test-v8-jet-lane.html"
ENGINE = open("/home/z/my-project/scripts/jet-engine.js", encoding="utf-8").read()
SW_TEMPLATE = open("/home/z/my-project/scripts/fate-sw.js", encoding="utf-8").read()
SW_DST = "/home/z/my-project/download/fate-sw.js"
JET_SW_SRC = "/home/z/my-project/upload/jet.sw.js"

ASSETS = ["jet.core.js", "jet.api.js", "jet.inject.js", "jet.utils.js", "jet.wasm"]
UP = "/home/z/my-project/upload"
DOWN = "/home/z/my-project/download"
DEPLOY = os.path.join(DOWN, "v8.2-deploy")

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

JET_SCRIPT = "<script>\n" + ENGINE + "\n</script>\n"

# 1. Apps button in the quick-actions row (after Shortcuts)
must_replace(
    """    <button class="q-btn" onclick="toggleShortcuts()">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zM7 18H5v-2h2v2zm3 0H8v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zM18 8h-2v2h2V8zm0 3h-2v2h2v-2z"/></svg>
      Shortcuts
    </button>""",
    """    <button class="q-btn" onclick="toggleShortcuts()">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zM7 18H5v-2h2v2zm3 0H8v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zm3 0h-2v-2h2v2zM18 8h-2v2h2V8zm0 3h-2v2h2v-2z"/></svg>
      Shortcuts
    </button>
    <button class="q-btn" onclick="fateToggleApps()" title="Open proxied apps (A)">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
      Apps
    </button>""",
    "apps quick-action button")

# 2. "Open full TikTok" button in the TikTok view header (before Reload)
must_replace(
    """      <button class="tt-btn" onclick="reloadTikTok()" title="Refetch the feed through the fastest lane">""",
    """      <button class="tt-btn tt-btn-cyan" onclick="fateBrowseOpen('https://www.tiktok.com/foryou')" title="Open the real TikTok through the jet proxy">Open full TikTok</button>
      <button class="tt-btn" onclick="reloadTikTok()" title="Refetch the feed through the fastest lane">""",
    "open full tiktok button")

# 3. footer stamp v7 -> v8.2
must_replace(
    'cloud build v7 — tiktok feed + wisp lane tunnel + smart player + arcade network',
    'cloud build v8.2 — jet proxy (self-healing boot) + tiktok feed + wisp lane tunnel',
    "footer stamp v8.2")

# 4. hotkey A opens apps
must_replace(
    "      case 't': case 'T': toggleTikTokView(); break;",
    "      case 't': case 'T': toggleTikTokView(); break;\n      case 'a': case 'A': fateToggleApps(); break;",
    "hotkey A")

# 5. engine script before </body> (after the v7 engine block)
must_replace(
    "/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */\n\n</script>\n</body>",
    "/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */\n\n</script>\n" + JET_SCRIPT + "</body>",
    "v8.2 jet engine script")

# 6. transport init: retry while "wasm not loaded" (official recipe)
must_replace(
    """      const t = new C({ wisp: window.wlspServer });
      await t.init();""",
    """      const t = new C({ wisp: window.wlspServer });
      for (let _ti = 0; _ti < 150; _ti++){
        try { await t.init(); break; }
        catch (_e){
          if (!String(_e).includes('wasm not loaded') || _ti === 149) throw _e;
          await new Promise(_r => setTimeout(_r, 20));
        }
      }""",
    "transport init wasm retry")

open(DST, "w", encoding="utf-8").write(html)

# 7. fate-sw.js v3 with jet.sw.js inlined (self-contained companion SW)
jet_sw = open(JET_SW_SRC, encoding="utf-8").read()
if "/*__JET_SW_INLINE__*/" not in SW_TEMPLATE:
    print("FAIL: SW template placeholder missing")
    sys.exit(1)
sw_final = SW_TEMPLATE.replace("/*__JET_SW_INLINE__*/", jet_sw)
open(SW_DST, "w", encoding="utf-8").write(sw_final)
print(f"ok: fate-sw.js v3 with inlined jet.sw.js ({len(sw_final)/1024:.1f} KB)")

# 8. deployment folder: EXACTLY the 7 files the user needs, nothing else
os.makedirs(DEPLOY, exist_ok=True)
shutil.copyfile(DST, os.path.join(DEPLOY, "test.html"))
shutil.copyfile(SW_DST, os.path.join(DEPLOY, "fate-sw.js"))
for f in ASSETS:
    shutil.copyfile(os.path.join(UP, f), os.path.join(DEPLOY, f))
    print(f"ok: asset {f} -> v8.2-deploy/ ({os.path.getsize(os.path.join(DEPLOY, f))} bytes)")
print(f"ok: test.html -> v8.2-deploy/ ({os.path.getsize(os.path.join(DEPLOY, 'test.html'))/1024:.1f} KB)")
print(f"ok: fate-sw.js -> v8.2-deploy/ ({os.path.getsize(os.path.join(DEPLOY, 'fate-sw.js'))/1024:.1f} KB)")

print(f"\nbuilt: {DST} ({len(html) / 1024:.1f} KB, src {orig_len / 1024:.1f} KB)")
print("deploy: upload the CONTENTS of download/v8.2-deploy/ (7 files) in ONE folder, keep names exactly")
