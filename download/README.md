# Fate Portal builds

## Which file should I deploy? (2026-10-27, v7)

**`test-v7-tiktok-feed.html`** — this is the one. Deploy it as `test.html`
(replace the old file) and hard-refresh (iPad: hold refresh → "Reload Without
Content Blocker" or clear the tab, then reload twice).

It carries everything from v6 (2.5k arcade games + 163 cloud games + wisp
lane engine + smart blob player) and adds the **FATE TikTok page**.

### v7 additions — FATE TikTok

A full TikTok page inside the portal, in FATE V6 style (dark glass + gold):

1. **TikTok toggle** in the stats bar (cyan music note) — or press **T**.
   The games grid / cloud view / TikTok are mutually exclusive views and
   videos always stop when you leave the page.
2. **Vertical snap feed** (TikTok-style): autoplay on the card in view,
   pause off-screen, tap to pause/play, speaker icon unmutes, gradient
   progress bar, infinite scroll for more.
3. **Per-video overlay**: @author, caption, music title (cyan), duration +
   region + "no watermark", and the real counts rail — likes, comments,
   shares, plays (829.9K / 7K / 243.1K / 10.2M on the E2E test card).
4. **Region picker**: US (default) / UK / DE / FR / JP / BR — persisted.
5. **Search** box riding the same lanes; if TikTok's search endpoint is
   bot-gated on your network the For You feed still works (honest error +
   Clear button).
6. **4 data lanes with auto-retry**: direct → allorigins → codetabs →
   **wisp tunnel** (your v6 curl-transport over the fastest wisp lane —
   same exit as the cloud games). The winning lane is remembered
   (`fate_tiktok_lane_v7`). tikwm truncates responses under load sometimes,
   so the lane ladder auto-retries once before showing an error.
7. **Blob fallback for blocked CDNs**: if your network blocks the TikTok
   video CDN, the video is fetched through the lanes and re-served as a
   blob URL automatically.

How it works: the feed comes from the public **tikwm** API (`ACAO:*`, no
key), which returns no-watermark mp4s + covers + music + author + counts.
Verified live in E2E: 8-card feed via the direct lane, autoplay + pause
switching on scroll, unmute, tap-pause, region reloads, cloud view
regression (163 cloud games intact), close-stops-playback.

### v6 (previous) — wisp lane cloud engine

1. **Real wisp (WLSP) lane sweep** — the portal now runs the same binary
   handshake the official portal uses (frame `[type][id][payload]`, control
   stream 0, echo probe) against all 11 known servers (9 `cdn.*` mirrors +
   `wss://athollcottage.com/connection/` + `wss://api.personalloanonline.net/ws/`).
   Live result during the build E2E: **9 of 11 lanes answered** (only
   northstreetumc was down). Fastest alive lane is pinned and cached
   (localStorage `fate_wisp_lane_v6`, 10-min TTL).
2. **curl-transport over the tunnel** — the portal dynamically imports the
   real transport module (`curl/index.mjs`, libcurl-wasm, 2.1 MB) racing
   14 asset-base mirrors of `TongSherbet/storage@main` (jsDelivr edges ×4,
   statically, githack ×2, raw.githubusercontent, staticdeliver, etc.),
   then binds it to the winning wisp lane. Verified live: transport READY
   in-page within seconds.
3. **Stratus API through 4 lanes** — the catalog sweep now races direct +
   codetabs + allorigins + **wisp-tunnel** lanes. `stratusApi()` prefers the
   tunnel when the transport is up and falls back to the direct ladder.
   `stratusFetch` now supports POST + JSON body (the v5 version silently
   downgraded session creates to GET — fixed).
4. **Session flow fixes against the CURRENT backend**:
   - `POST /stratus/session {game_key, relay, client_key}` works (real
     uuids returned, real instances boot — verified live).
   - Signaling now uses the **absolute `signaling_ws` URL the start response
     returns** (`wss://host/signal/<uuid>`) instead of the obsolete
     `/stratus/signal/<uuid>` path. Legacy id-only values still build the
     old path as fallback.
   - Signaling WebSocket rides the wisp tunnel when possible with a
     **transparent 6 s native-WebSocket fallback** (matches the official
     client, which connects natively).
   - Real ICE/TURN from the backend is honored (`stun:stun.l.google.com`,
     `turn:154.85.66.15` flash/flash1234).
5. **Wisp panel UI** (inside the cloud view's self-test box): per-server
   RTT chips, active lane, transport state, resolved bases, and a **"set
   base" input** — if you ever learn a backend host (e.g. from a working
   portal), type it there and the whole cloud stack points at it instantly.

### Live E2E evidence (build-time, sandbox browser)

- `[FATE v6] wisp transport READY - lane wss://api.personalloanonline.net/ws/`
- sweep winner `cdn.kcchallengevbc.com` → **163 cloud games** rendered in the
  cloud grid (backend pool healthy: 8–9 idle instances, 12 egress exits)
- real session created + booted: `{"uuid":"ac1fd1a3-…","state":"active"}`,
  `time_left` countdown, TURN ICE delivered
- screenshots: `scripts/verify-v6-cloud-live.png`, `scripts/verify-v6-wisp-panel.png`

### Known limits

- The backend's signaling WS refuses connections from **datacenter IPs**
  (verified: WS upgrade error from the sandbox, while your residential
  network should pass). If YOUR network still blocks the mirrors, signaling
  may fail — the wisp panel will show it; the 6 s fallback keeps native
  attempts honest.
- HTTP-over-tunnel to Cloudflare-fronted mirrors currently hangs server-side
  (CF drops the tunnel box's HTTP). The tunnel still shines for anything not
  CF-fronted and for the self-healing lane sweep.

### Backend intel (for future rounds)

- Wisp servers double as Stratus mirrors; the 2 wss backups
  (`athollcottage.com/connection/`, `api.personalloanonline.net/ws/`,
  bare box 92.38.177.45) are wisp-only today (no /stratus route on :443).
- The official portal network: `opium.best` (Cloudflare) → relay pages
  (`im-single` repo: `relays.js`) → decoy pages (APStudy etc.) boot
  `loader.js` from 16 asset-base mirrors of `TongSherbet/storage@main`.
- Cloud catalog shape: `{games:[{name,key,cover}], total}`; session shape:
  `{uuid,state,game_key}` → `/start` → `{signaling_ws, ice_servers,
  max_seconds, relay}`; input = WebRTC DataChannel **"JYSDK"** (12-byte
  mouse frames `[1,11,flags,8,x1e4,y1e4,dx,dy,btns,wheel]`, variable
  keyboard frames) — all already ported in the portal's cloud player.

## v5 (previous, still good)

**`test-v5-smart-player.html`** — v3 cloud stack + v4 arcade network
(~2,400 games) + the v5 smart player (blob re-serving to beat the
text/plain MIME bug, auto `<base>`, viewport guard, on-screen keys bar,
open-in-new-tab with blob URLs).

## v3/v4

- `test-v4-arcade-network.html` — 27-lane cloud sweep + 2,413-game arcade
  network (ckv/ugs/seraph/gnm via jsDelivr).
- `test-v3-cloud-reload.html` — 27-lane sweep + parallel mirror self-test +
  seed slot + persistent retry.

## Build scripts

- `scripts/build-portal-v7.py` — v6 → v7 (8 anchored patches; inlines
  `scripts/tt-engine.js`; rebuilds `test-v7-tiktok-feed.html` from
  `test-v6-wisp-lane.html`).
- `scripts/build-portal-v6.py` — v5 → v6 (13 anchored patches; rebuilds
  `test-v6-wisp-lane.html` from `test-v5-smart-player.html`).
- `scripts/wisp-probe.mjs` — Node wisp liveness prober (11 servers).
- `scripts/wisp-one.mjs` / `wisp-sweep.mjs` — HTTP-over-wisp tests.
- `scripts/wisp-tcp.mjs` — raw TCP-over-wisp experiments.
- `scripts/out/main-v2-payload-1-eval.js` — decoded official client
  (source of truth for the Stratus protocol + JYSDK input).
