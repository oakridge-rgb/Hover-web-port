# FATE Portal — v8.2 (jet proxy, self-healing boot)

## "It just keeps booting and never starts" — FIXED

Root causes found and fixed in v8.2 (found by decoding the reference site's own loader —
they solved every one of these already; v8.2 now runs their exact recipe):

1. **No timeout on the jet handshake** — `await controller.ready` waited forever if the
   Service Worker missed one message. Now: the handshake is retried up to 5×4s with a
   FRESH MessageChannel port each time (official recipe), then the SW self-resets.
2. **Stale/corrupted Service Workers were never cleaned up** — an old SW from a previous
   deploy stayed active and broke every boot. Now: `swReset()` unregisters ALL SWs and
   reloads once (guarded), after one guarded soft reload — exactly the official ladder.
3. **"proxy warming up" refreshed forever** — the SW's 503 retry page meta-refreshed
   every second, forever. Now capped at 4 auto-retries, then a clear stuck-screen with
   a Retry button.
4. **SW churn destabilized fetch interception** — re-registering/updating the SW on
   every boot created a window where requests bypassed the SW. Now: fast path (if the
   page is already controlled, zero re-registration), and the probe is non-fatal.
5. **Reloads left the user on a dead screen** — recovery reloads now auto-resume the
   boot (and re-open the app you tapped) via sessionStorage.
6. **iPad tab freezing** — SW health watcher every 20s + on focus/visibility; fresh
   MessageChannel port on controllerchange; pending requests resolved on pagehide.

## Deploy — ONLY these 7 files (answers "do we need all of these files?")

Upload the **contents** of `v8.2-deploy/` into ONE folder on your host, names exact:

| File | Required? | What it is |
|---|---|---|
| `test.html` | REQUIRED | the portal (v8.2, 205 KB) |
| `fate-sw.js` | REQUIRED | service worker (jet.sw.js already baked in — self-contained) |
| `jet.core.js` | REQUIRED | jet rewriter engine |
| `jet.api.js` | REQUIRED | jet controller ($jetController) |
| `jet.inject.js` | REQUIRED | injected into every proxied page |
| `jet.wasm` | REQUIRED | TLS fingerprint wasm (fetch as binary) |
| `jet.utils.js` | optional | link capture / address bar / cache plugins |

**Everything else in `download/` (v2–v8.1 files, old copies) is legacy — do not upload,
you can ignore or delete it.** HTTPS is required (service workers). Subfolders are fine.

## How to use

- **Apps button** in the quick-actions row (or press **A**) — 10 tiles, same set as the
  reference site: TikTok /foryou, YouTube, Geforce Now, Geometry Dash, Kick, Twitch,
  Snapchat (www.snapchat.com/web), Instagram, Discord, **Movies (aether.ist)**.
- First tap on any app boots the proxy (progress pill at the top of the page:
  sw → files → tunnel → controller → ready). First-ever visit may silently reload the
  page once (SW claim) and continues by itself — ~2s on a warm cache.
- If a proxied page shows "proxy warming up", it auto-retries up to 4×; if it ever
  shows "stuck", go back to the portal tab, keep it in the FOREGROUND (iPads freeze
  background tabs — that is the #1 cause), then tap Retry.
- The ↗ button opens the current site without the proxy (escape hatch).

## Verified (agent-browser E2E)

- First visit, single tap: recovery reloads transparent → **READY in ~2s** → real
  example.com rendered through the tunnel (address bar decodes real URL).
- Proxied **TikTok /foryou**: full SPA, title "TikTok - Make Your Day".
- Proxied YouTube: UI renders; Shorts/videos ride the same tunnel.
- **Pass B (fate-sw.js missing):** fails CLEAN in seconds with "deploy fate-sw.js"
  message — page stays put, **no reload loop** (the old behavior).
- Cloud games + arcade + TikTok feed regressions: intact (2413 arcade / 163 cloud).
- node syntax clean on all script blocks + fate-sw.js. Evidence: `scripts/verify-v82-*.png`.

## For debugging (only if something still fails)

Open the Apps modal — the status box shows each boot stage and where every jet file
loaded from (`local` = your hosting, `mirror n` = CDN fallback). The amber pill at the
top shows live boot progress and turns into a red tap-to-retry pill on failure.
