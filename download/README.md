# FATE Portal — v8.2 (jet proxy, self-healing boot) + FATE Movies + FATE Browser

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

## Deploy — ONLY these 9 files (answers "do we need all of these files?")

Upload the **contents** of `v8.2-deploy/` into ONE folder on your host, names exact:

| File | Required? | What it is |
|---|---|---|
| `test.html` | REQUIRED | the portal (v8.2, 205 KB) |
| `movies.html` | REQUIRED | **FATE Movies** — dedicated movies-only page (no games) |
| `browser.html` | REQUIRED | **FATE Browser** — multi-tab web browser over the jet tunnel |
| `fate-sw.js` | REQUIRED | service worker (jet.sw.js already baked in — self-contained) |
| `jet.core.js` | REQUIRED | jet rewriter engine |
| `jet.api.js` | REQUIRED | jet controller ($jetController) |
| `jet.inject.js` | REQUIRED | injected into every proxied page |
| `jet.wasm` | REQUIRED | TLS fingerprint wasm (fetch as binary) |
| `jet.utils.js` | optional | link capture / address bar / cache plugins |

**Everything else in `download/` (v2–v8.1 files, old copies) is legacy — do not upload,
you can ignore or delete it.** HTTPS is required (service workers). Subfolders are fine.

## FATE Movies (`movies.html`)

A dedicated movies-only page in the same FATE style — **no games, no portal, just cinema**.
Same login as the portal (opens straight through if you're already in `test.html`).

Three ways to watch:
1. **Stream sites** — Aether (the reference site's Movies pick), Tubi, Internet Archive,
   YouTube Movies — each opens full-screen through the jet tunnel (back/reload work in-portal).
2. **Free movie vault** — a searchable poster wall of movie streams (movie groups from
   Free-TV / iptv-org / Somestuff playlists; ~700 movies). Tap a poster → plays right on the
   page (hls.js + artplayer, the same engine as your TV page). Dead stream? ⟳ Retry / ⏭ Next.
3. **Instant player** — paste ANY `.m3u8` or `.mp4` link at the top and hit Play.

The tunnel auto-boots when the page loads (chip in the nav shows the lane). If direct
playlist downloads are blocked on your network, the vault automatically re-fetches them
through the jet tunnel. Keep the tab in the FOREGROUND on iPad during first boot.

## FATE Browser (`browser.html`)

A real multi-tab web browser in the FATE style — every tab is its own jet-tunnel frame
(one `createFrame()` per tab, each with a private `/~/{frameId}/` route through the same
service worker). Same login as the portal; the tunnel auto-boots on page load.

- **Tab strip** — chips with live titles + spinners, `×` to close, `+` for a new tab;
  switching tabs keeps every site loaded (background tabs stay alive).
- **Toolbar** — Back / Forward (full per-tab history, SPA pushState tracked), Reload,
  Home, address bar (decodes the REAL url of the proxied page as you browse), Go, and
  `↗` pop-out (opens the site direct, no proxy).
- **Start page** — Google-or-URL search box, 9 shortcut tiles (TikTok / YouTube /
  Snapchat / Instagram / Discord / Twitch / Reddit / Wikipedia / Google — no games), a
  **FATE Movies** tile (opens `movies.html`), and **Recent** chips from your browsing.
- **Search box semantics** — type words → Google search through the tunnel; type a
  domain → goes straight to it.
- **Session restore** — reload the page (or a self-heal reload fires) and your tabs come
  back and reconnect through the tunnel by themselves.
- Keep this tab in the FOREGROUND on iPad — it powers the tunnel (same rule as always).

## How to use (portal)

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

## FATE Movies — verified (agent-browser E2E)

- Gate: same `fate_v6_auth` login as the portal — authed session opens straight through.
- Tunnel: auto-boots on page load → READY, all 5 jet assets `local`, lane chip green.
- Aether through the jet tunnel: real page loads, address bar decodes.
- Vault: **699 movies** rendered (Free-TV + iptv-org alive; the ladder auto-falls-back per
  source, and a jet-tunnel lane kicks in for blocked sources once the proxy is ready).
- Player: Mux test m3u8 → readyState 4, **actually playing** (duration 635s, autoplay ok);
  Retry/Next flows verified on dead IPTV streams; search "Pluto" → 164 hits.
- **Zero game code on the page** (only the login fallback + the words "no games").
- node syntax clean on all 5 script blocks. Evidence: `scripts/verify-movies-*.png`.

## FATE Browser — verified (agent-browser E2E)

- Boot: READY in ~2s warm (all 5 jet assets `local`, lane `api.personalloanonline.net`).
- Real sites through the tunnel with real titles: **example.com** ("Example Domain"),
  **wikipedia.org** ("Wikipedia"), **reddit.com** (renders its real challenge page),
  **tiktok.com/foryou** ("TikTok - Make Your Day"), **Google search** ("cute cats" →
  real results page).
- Multi-tab: 2 tabs live at once with **private per-frame prefixes** (`/~/wz5myeos/anzcoimc/`
  vs `/~/wz5myeos/u526r3lu/`); switching tabs preserves each site; closing a tab
  activates its neighbor; closing the last tab opens a fresh one.
- Back / Forward verified across example.com ↔ wikipedia with a stable 2-entry stack
  (redirect variants collapse in place — Back never looks like a no-op).
- Address bar syncs to the decoded real URL on every load; tab titles come from the
  page's own `<title>`.
- Start page: 9 tiles, Movies tile, **Recent** chips (deduped by origin+path).
- **Session restore**: 2 tabs (incl. TikTok) survive a page reload and reconnect
  through the tunnel automatically.
- node syntax clean on all 4 script blocks. Evidence: `scripts/verify-browser-*.png`.

## For debugging (only if something still fails)

Open the Apps modal — the status box shows each boot stage and where every jet file
loaded from (`local` = your hosting, `mirror n` = CDN fallback). The amber pill at the
top shows live boot progress and turns into a red tap-to-retry pill on failure.

## FATE Arcade — 35k games (NEW, verified agent-browser E2E)

- **`games.html` + `fate-games-cat.js`** — the whole Storm0S vault, FATE style. The
  portal FAB's "Games" button now opens **35,310 games from 69 libraries** (GN-Math,
  Unb Games, Nebula, UGS, js13kGames, CVK, Hydra, Lumin, GhostProxy, DuckMath…).
- Catalog ships gzipped+base64 (2.7 MB file, same technique Storm0S uses) and
  unpacks via `DecompressionStream('gzip')` in ~0.2 s on device.
- **Play pipeline (Storm0S recipe)**: `fetchGame:true` games are fetched (with a
  jsdelivr→raw.githubusercontent mirror ladder), get `<base href>` injected, then run
  from a **same-origin blob URL** — X-Frame-Options/CSP embed blocks are bypassed.
  `frameFallback` + no-flag games load as direct embeds (gamemonetize etc.).
- **⚡ Tunnel button** in the player = jet/wisp proxy retry: the whole game loads
  through your lane (`./~/…`) when a host is blocked. Tunnel auto-boots in the
  background and the nav chip shows its state.
- Player bar: back / status / ⚡Tunnel / reload / new-tab (opens the fetched blob) /
  fullscreen. Favorites ♡ + Recent + search + 69 library pills + kind filter +
  sort + random + auto-load infinite scroll all persist locally.
- Verified E2E: Bowmasters fully playable via fetch+blob ("YOU vs Crazy Sam" screen);
  Tiny Arcade site rendering through the tunnel; gamemonetize "TAP TO START" direct
  embed; favorites/recent views; player close; catalog 0.2 s unpack. Evidence:
  `scripts/verify-games-1..5.png`.
- Deploy: add **`games.html`** + **`fate-games-cat.js`** to the same folder as the
  other files (deploy set is now **11 files**) — no new service worker, no CDN deps.


## FATE Arcade v2 — direct CDN games (2026-10-29)

**`games.html` + `fate-games-cat.js` rebuilt: 31,615 games, 67 libraries, ZERO jet.**

- Games load straight from their CDNs in your browser — no wisp tunnel, no jet boot, no proxy lag.
  The page opens instantly (catalog unpacks in ~0.2s).
- Two play modes, chosen automatically per host:
  * **Direct embed** — for hosts that allow framing (gamemonetize, github.io, githack, custom sites).
  * **Code fetch** — for jsDelivr/raw hosts that serve HTML as text/plain: the page fetches the game
    code from the fastest of 5 jsDelivr mirrors + raw fallback, injects `<base>`, and runs it locally
    in a blob (kills X-Frame-Options and text/plain issues — same technique Storm 0S uses).
- Black screen on a game? Tap **⤓ Code** in the player bar — it re-loads that game via code fetch.
- Catalog was cleaned before shipping: dead hosts removed (404/410/XFO-locked), GhostProxy's 760
  dead games dropped, 2,868 duplicate URLs merged, raw.githubusercontent URLs rewritten to jsDelivr.
- Files to upload for this feature: `games.html`, `fate-games-cat.js`, plus the existing
  `pass.js` (new, include it) — everything else stays as-is.


## FATE Arcade v3 — jsDelivr-ONLY catalog (2026-10-29)

**Rebuilt: 22,727 games / 58 libraries — every single URL now lives on `*.jsdelivr.net`. Zero jet, zero proxy, zero other hosts.**

- Why: non-jsDelivr hosts (gamemonetize, github.io, crazygames, gamedistribution, itch.zone, custom
  sites…) get blocked on locked-down networks. jsDelivr is the one game CDN already proven working
  on the iPad, so the catalog now ships **only** what it can guarantee.
- What got cut vs v2 (31,615): **5,000 gamemonetize** games (the old "Unb Games" library), ~1,150
  github.io pages, ~1,000 other-host games, **892 dead URLs** (every rewritten raw/githack link was
  probed — 404s purged), 3,676 duplicate URLs merged.
- Rescued in: `raw.githubusercontent.com` / `rawcdn.githack.com` links rewritten to
  `cdn.jsdelivr.net/gh/...` — then **probed one by one**; survivors only (GN-Math lost ~40 dead,
  CCPorted kept 142 live, GhostLink 849 live).
- Images: only jsDelivr-hosted thumbnails kept (12,836); the rest render as clean letter tiles.
- Catalog file is now **0.48 MB** (was 2.37 MB) — faster to fetch, still unpacks via
  `DecompressionStream('gzip')`.
- Loader behavior (unchanged pipeline, proven on device): jsDelivr serves game HTML as
  `text/plain` + `nosniff`, so every game is **fetched** (fastest of 5 jsDelivr mirrors:
  cdn → fastly → gcore → testingcf → quantil, race + ladder) → `<base>` injected → runs from a
  local blob. This kills text/plain, X-Frame-Options and mixed-content issues in one move.
- Files to upload: same two — `games.html`, `fate-games-cat.js`. Nothing else changed.

### v3.1 — portal reskin (2026-10-29)

**`games.html` rebuilt as a clone of the portal's Games page — with cloud games, WITHOUT the Apps section.**

- Identical portal look: PANIC nav, "FATE V6 Games" hero, Favorites/Random/Shortcuts quick-actions,
  All/Arcade/Emulator/Flash pills (Hot/New/Experimental replaced with the vault's real kinds),
  stats bar with the **Cloud** + **TikTok** toggles, skeletons, infinite scroll, game popup with
  the CDN picker (9 providers incl. 5 jsDelivr edges) and the v5 smart player (fetch+blob).
- **Removed**: the Apps quick-action button, the FATE Apps modal, the `A` keyboard shortcut.
  TikTok toggle + jet browse view stay (TikTok uses them).
- Arcade grid = the 22,727-game jsDelivr-only vault (portal name-dedupe collapses cross-library
  clones → **10,032 unique arcade games**); Stratus cloud games merge in live (non-blocking sweep).
- Favorites/recents share the portal's storage keys (`fate_v5_favorites` / `fate_v5_recent`).
- Verified E2E: grid + pills + 208 cloud games merged, CDN picker → Direct → Bowmasters playable,
  cloud view renders 208 cards with Reload/Check-mirrors. Evidence: `scripts/verify-v82-games-portal-1..3.png`.
- Deploy: re-upload **`games.html`** only (catalog file unchanged from v3).


## Cloud Moon lane — CloudMoon as a second cloud backend (2026-10-30)

**test.html now has a ☾ Moon toggle next to Cloud/TikTok. It streams CloudMoon's cloud phones
(web.cloudmoonapp.com) — a completely separate backend from the Stratus mirrors, so it works
even when the mirrors read "0 idle accounts".**

- Catalog: 237 games fetched client-side from `api.prod.cloudmoonapp.com/game/guest_list`
  (open CORS, guest-readable, device_id UUID stored in localStorage, 30-min cache, saved copy
  shown offline). Roblox, Fortnite, Genshin, CoD Mobile, Roblox, TikTok/Chrome/YouTube apps etc.
- Launch: card click → CloudMoon's own game page inside the game popup iframe (their site sets
  NO X-Frame-Options, verified). "Open in New Tab" stays available as fallback.
- First use: CloudMoon asks for a one-time sign-in (Google / Apple / email) with a server
  picker — that modal works in-frame; if Google blocks the popup, use Open in New Tab.
- Free tier: limited minutes per session, ~3-minute cooldown between launches, queue at peak.
  Cards tagged `G` (9/237) want their own game login once the stream starts.
- Keyboard: `M` toggles the Moon view.
- Verified E2E: catalog loads (237), moon grid renders with MOON badges, Roblox page opens
  in-frame, sign-in modal renders with server picker. Evidence: `scripts/verify-moon-*.png`.
- Why Stratus said "0 idle accounts" at school: (1) most cdn.* mirrors are filter-blocked at
  school and the public CORS proxies are GET-only — they can carry /status and /games but NOT
  the POST /stratus/session, and when /status fails the UI falls back to `0 idle accounts`;
  (2) at lunch-peak the 20-account pool is genuinely drained (sessions linger up to 19 min
  after tabs close). Backend itself is healthy off-peak (idle 7–9 verified). One mirror
  (cdn.northstreetumc.org) is now Cloudflare bot-gated and can be ignored.
- Deploy: re-upload **`test.html`** only.
