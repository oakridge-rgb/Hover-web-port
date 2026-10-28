#!/usr/bin/env python3
# build-portal-v81.py — v7 -> v8.1 "jet lane, local-first assets" upgrade
# Changes vs v8:
#   - jet files (core/api/inject/utils/wasm) resolve LOCAL-FIRST (flat or /sj/
#     next to test.html), then fall back to the 7 CDN mirrors — per file,
#     probed in parallel, soft-404 guarded. Fixes "not working the best" when
#     jsDelivr is throttled/blocked on the user's network.
#   - fate-sw.js v2 is SELF-CONTAINED (jet.sw.js inlined at build time).
#   - hardened SW start: register(updateViaCache:'none') + update() + activate
#     wait + claim + one soft reload; survives foreign/old SW at same scope.
#   - jet.utils.js is now OPTIONAL and actually USED: EventHandler + LinkHandler
#     (new-tab links stay in-portal) + UrlWatcher (live address bar) + HttpCache.
#   - apps grid mirrors the reference SHORTCUTS: TikTok, YouTube, Snapchat,
#     Movies (aether.ist), Instagram, Discord, Twitch, Kick.
# Deploy: test.html + fate-sw.js (+ the 5 jet files, strongly recommended)
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

# 3. footer stamp v7 -> v8.1
must_replace(
    'cloud build v7 — tiktok feed + wisp lane tunnel + smart player + arcade network',
    'cloud build v8.1 — jet proxy (local-first assets) + tiktok feed + wisp lane tunnel',
    "footer stamp v8.1")

# 4. hotkey A opens apps
must_replace(
    "      case 't': case 'T': toggleTikTokView(); break;",
    "      case 't': case 'T': toggleTikTokView(); break;\n      case 'a': case 'A': fateToggleApps(); break;",
    "hotkey A")

# 5. engine script before </body> (after the v7 engine block)
must_replace(
    "/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */\n\n</script>\n</body>",
    "/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */\n\n</script>\n" + JET_SCRIPT + "</body>",
    "v8.1 jet engine script")

open(DST, "w", encoding="utf-8").write(html)

# 6. fate-sw.js v2 with jet.sw.js inlined (self-contained companion SW)
jet_sw = open(JET_SW_SRC, encoding="utf-8").read()
if "/*__JET_SW_INLINE__*/" not in SW_TEMPLATE:
    print("FAIL: SW template placeholder missing")
    sys.exit(1)
sw_final = SW_TEMPLATE.replace("/*__JET_SW_INLINE__*/", jet_sw)
open(SW_DST, "w", encoding="utf-8").write(sw_final)
print(f"ok: fate-sw.js v2 with inlined jet.sw.js ({len(sw_final)/1024:.1f} KB)")

# 7. copy the jet asset files flat next to the portal (user uploads these too)
for f in ASSETS:
    srcf = os.path.join(UP, f)
    dstf = os.path.join(DOWN, f)
    shutil.copyfile(srcf, dstf)
    print(f"ok: asset {f} -> download/ ({os.path.getsize(dstf)} bytes)")

print(f"\nbuilt: {DST} ({len(html) / 1024:.1f} KB, src {orig_len / 1024:.1f} KB)")
print("deploy: test.html + fate-sw.js + jet.core.js + jet.api.js + jet.inject.js + jet.utils.js + jet.wasm (all in the SAME folder)")
