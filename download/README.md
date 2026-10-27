# Fate Portal builds

## Which file should I deploy? (2026-10-27)

**`test-v5-smart-player.html`** — this is the one. It is the user's portal
(`upload/test.html`) carrying the FULL v3 cloud stack, the v4 arcade network
(~2,400 games), **plus the v5 smart player** that actually makes those
2,400 games playable.

### v5 additions — smart player (the "shows code / black screen" fix)

**Root cause found:** jsDelivr serves EVERY GitHub-hosted `.html` as
`content-type: text/plain` — that is why opening a game in a new tab showed
the raw "games txt code" instead of the game. It affects all four game
sources (ckv, ugs, seraph, gn-math), not just game 618. (Your iPad only
looked different because it had an older HTML copy cached from before the
MIME change; the game page it rendered then sits on black screens waiting
for ENTER/ESCAPE — a keyboard it doesn't have.)

The v5 fix, all verified live in the sandbox on real games:

1. **Fetch → blob lane**: the player fetches the game source itself
   (jsDelivr sends `access-control-allow-origin: *`), patches it, and
   re-serves it as a real `text/html` blob inside the sandboxed iframe.
   The MIME problem is bypassed completely — FNF Bob's Onslaught and
   10 Minutes till Dawn both boot and render in the player.
2. **Auto `<base>` injection** so games with relative asset paths still
   load; the game's own `<base>` is respected when present.
3. **Viewport landmine guard**: some OpenFL pages call
   `getElementById("viewport")` without defining it → TypeError that can
   kill boot on high-DPI phones; the patch injects the missing meta.
4. **On-screen KEYS bar** (the key icon in the player header): ESC, ENTER,
   SPACE, arrows, WASD, R — hold-to-press, dispatching real KeyboardEvents
   into the game. Auto-opens on touch devices (iPad!). Verified: tapping
   ESC in the bar dismisses FNF's flashing-lights warning screen.
5. **New-tab button fixed the same way** — opens the blob page, not the
   raw text/plain URL.
6. **Edge-fallback fetch chain** (cdn → gcore → testingcf → fastly →
   originfastly jsDelivr), 20 s timeout per lane, honest fallback to the
   old direct-src behavior if every lane fails.
7. **Loader hint** so nobody mistakes a big game's one-minute black
   loading screen for a broken portal.

Note: UGS single-file games start with a `<Module>` preamble before the
real HTML — the lane accepts that (validated, not "starts-with-tag").

### v4 arcade network (unchanged, ~2,400 games)

| Source | Index | Games repo | Loaded |
|--------|-------|-----------|--------|
| ckv | `gh/%54ongSherbet/storage@main/ckv.json` | `gmshelf/ckv` | 843 |
| ugs | `gh/%54ongSherbet/storage@main/ugs.json` | `bubbls/ugs-singlefile` | 1,150 |
| seraph | `gh/gmshelf/seraph/seraph.json` | `gmshelf/seraph` | 223 |
| gn-math | `gh/freebuisness/assets/zones.json` | `freebuisness/html` + covers | 197 |

- Multi-edge fallback per source; local catalogs keep dedupe priority
- CDN picker still lets you switch lanes per game (picker note updated)

### Cloud section — unchanged from v3

- 27-lane sweep (9 mirrors x direct + codetabs + allorigins), Reload
  games button, Check mirrors self-test (~30 s parallel), persistent
  auto-retry (~5 h), seed-catalog slot
- Stratus mirrors UNCHANGED (same 9 `cdn.*` + 2 wss backups per the fresh
  loader decode); the origin still flaps — cloud games merge in when it
  answers

### Verify your deployment

- view-source near `</head>`: `FATE PORTAL BUILD v5 (2026-10-27)`
- console: `[FATE PORTAL v5] smart player ready - fetch+blob lane…` and
  `[FATE PORTAL v5] arcade network + cloud stack build 2026-10-27`
- footer chip: `cloud build v5 — smart player + touch keys + arcade network + 27-lane sweep`
- launching a GitHub game logs `[FATE PORTAL v5] smart lane: <url>` and the
  player URL starts with `blob:` — that's the fix working

Deploy: rename to `test.html`, replace the old file on the site, then
**Ctrl+Shift+R** to hard-refresh (your iPad may need the tab fully closed
and reopened to drop the old cached game page).

### E2E verified from the sandbox (2026-10-27)

- FNF vs Bob v2.0 (gnm): boots to the flashing-lights warning, ESC from
  the on-screen keys bar dismisses it, game loop keeps running (FPS)
- 10 Minutes till Dawn (ckv): full title menu rendered in the player
- Blob revoke on close/relaunch; zero page errors; all 5 script blocks
  pass `node --check`

Older files kept for reference: `test-v4-arcade-network.html` (v4 — games
listed but text/plain-broken in the player), `test-v3-cloud-reload.html`
(v3 stack only), `fate-portal-v2.html` (v2), `test-fixed.html` (Task-3 era).

## Note on the CDN itself (2026-10-27 diagnosis)

The Stratus cloud-gaming backend flaps in and out (verified across four
independent vantage points: direct, same-origin proxy, codetabs, allorigins
— and Cloudflare returned 522/502 "origin unreachable" from the public
proxies too). When the origin is down, NO client can load the catalog; the
portal keeps retrying and fills in by itself when the backend returns.
Use **Check mirrors** in the Cloud section to see the live per-mirror state
from your own network. The fresh `c.vipersfutbol.com/script.js` subdomain
found in the new build is only an ad-injection channel (skipped on purpose),
not a game backend.
