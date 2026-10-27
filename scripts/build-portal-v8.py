#!/usr/bin/env python3
# build-portal-v8.py — v7 -> v8 "jet lane" upgrade
# Adds: full jet proxy (MercuryWorkshop jet 2.0.67-alpha.2) over the wisp tunnel:
#   fate-sw.js companion SW, page-side boot (core/api/utils from mirror race),
#   device-fingerprint codec, FATE Apps modal (TikTok/YouTube/Snapchat/Movies),
#   in-portal browse view (iframe + address bar + back/reload/popout),
#   "Open full TikTok" in the TikTok view, hotkey A, v8 stamps.
# Run:  python3 scripts/build-portal-v8.py
import shutil, sys

SRC = "/home/z/my-project/download/test-v7-tiktok-feed.html"
DST = "/home/z/my-project/download/test-v8-jet-lane.html"
ENGINE = open("/home/z/my-project/scripts/jet-engine.js", encoding="utf-8").read()
SW_SRC = "/home/z/my-project/scripts/fate-sw.js"
SW_DST = "/home/z/my-project/download/fate-sw.js"

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

# 3. footer stamp v7 -> v8
must_replace(
    'cloud build v7 — tiktok feed + wisp lane tunnel + smart player + arcade network',
    'cloud build v8 — jet proxy apps + tiktok feed + wisp lane tunnel + smart player',
    "footer stamp v8")

# 4. hotkey A opens apps
must_replace(
    "      case 't': case 'T': toggleTikTokView(); break;",
    "      case 't': case 'T': toggleTikTokView(); break;\n      case 'a': case 'A': fateToggleApps(); break;",
    "hotkey A")

# 5. engine script before </body> (after the v7 engine block)
must_replace(
    "/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */\n\n</script>\n</body>",
    "/* ===== END FATE PORTAL v7 TIKTOK ENGINE ===== */\n\n</script>\n" + JET_SCRIPT + "</body>",
    "v8 jet engine script")

open(DST, "w", encoding="utf-8").write(html)
shutil.copyfile(SW_SRC, SW_DST)
print(f"\nbuilt: {DST} ({len(html) / 1024:.1f} KB, src {orig_len / 1024:.1f} KB)")
print(f"companion: {SW_DST} — deploy BOTH files in the SAME folder")
