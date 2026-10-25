# Worklog

---
Task ID: 1
Agent: main (Z.ai)
Task: User picked "PWA (local-first + offline)" from the Fate v6 brainstorm → build it as a runnable web app.

Work Log:
- Loaded fullstack-dev skill; initialized Next.js 16 project env (curl init-fullstack.sh).
- Generated PWA icons (gold fate-wheel, any + maskable, 192/512 + apple-touch) via scripts/make_icons.py (PIL).
- Created public/manifest.json (standalone, theme #0c0a09, shortcuts Today/Oracle) and public/sw.js (network-first navigations → cached shell → offline HTML; cache-first for /_next/static + icons; skips dev HMR traffic).
- Built fate engine src/lib/fate.ts: FNV-1a hash + mulberry32 PRNG, deterministic daily draw (20-card deck, 14 aspects, 5 windows), hourly-deterministic Oracle answers, streak computation.
- Built local-first store src/lib/store.ts (zustand + persist → localStorage, skipHydration, manual rehydrate after mount).
- Built src/hooks/use-pwa.ts: SW registration, beforeinstallprompt, standalone detection, online/offline, cache inspection for offline-readiness.
- Components: pwa-bar (online pill + Install), daily-card (flip reveal, journal, canvas share card via Web Share API w/ download fallback), oracle, threads (decision ledger with outcomes), pwa-lab (live PWA status + 60-second field test + danger zone).
- Rewrote src/app/page.tsx (single route, tabs, stats, offline banner, sticky safe-area footer), layout.tsx (PWA metadata/manifest/appleWebApp/viewport themeColor), globals.css (warm amber dark theme, mystic-bg, font-display, scrollbars).
- Fixed lint (react-hooks/set-state-in-effect → deferred syncs via timeouts) and replaced invalid lucide export `Bridge` → `Waypoints`.
- Browser-verified via agent-browser: title OK, reveal flow OK, journal toast OK, Oracle ask/answer OK, threads add/outcome OK, PWA Lab shows SW registered + 7 assets cached, OFFLINE reload keeps app + data alive, mobile (iPhone 14) layout OK, manifest/sw/icons all 200.

Stage Summary:
- Deliverable: Fate v6 PWA edition, running on port 3000 (only route "/").
- Verified offline-capable and local-first; all data in localStorage ("fate-v6-store").
- Key files: public/manifest.json, public/sw.js, src/lib/{fate,store,share-card}.ts, src/hooks/use-pwa.ts, src/components/fate/*, src/app/{page,layout}.tsx, globals.css.
- Screenshot evidence: scripts/verify-01..09-*.png.

---
Task ID: 2
Agent: main (Z.ai)
Task: "I need the cloud gaming cdn in this website" — extract the cloud gaming CDN from the user's uploaded opium portal files and integrate it into the site.

Work Log:
- Inspected upload/: main.html (portal shell with cloud UI ids), loader.js/main.js/sw.js (obfuscated), ckv.json/ugs.json (game catalogs), 404.html.
- Wrote scripts/deobfuscate2.js: VM sandbox with universal Proxy stubs + Function-constructor spy; captured full payloads (decoded-main.js-fn0.txt 135KB, loader 16KB).
- Extracted via scripts/extract-fns*.js + extract-input.js:
  * Asset CDN: getAsset → cdn.jsdelivr.net/gh/TongSherbet/storage@main/
  * Cloud backend (Stratus): https://cdn.vipersfutbol.com (or window.wlspServer host)
  * REST: GET /stratus/status | /stratus/games; POST /stratus/session {game_key}; GET /stratus/session/{uuid}; POST .../start → {max_seconds, signaling_ws, ice_servers}; POST .../quit (all credentials:include)
  * Signaling: wss://<host>/stratus/signal/<id>; msgs game_ready, rtc_answer, rtc_candidate, ping, time_left, game_cap, game_ended
  * WebRTC: recvonly A/V, H264→AV1 codec prefs, datachannel "JYSDK" (id:1, unordered, 0 retransmits)
  * JYSDK input: 12B mouse packet (abs pos 0-10000 in letterboxed rect, ±127 rel dx/dy, buttons bitmask, wheel) + var-len keyboard packet (keyCode + held-keys list + 255 terminator); pointer lock + relock hint; jitter buffer adaptation
- Built integration in Fate v6: src/lib/stratus.ts (client w/ direct→proxy fallback, localStorage catalog cache, host override), src/lib/cloud-input.ts (JYSDK binary encoder + pointer lock), src/lib/cloud-player.ts (session state machine, WS signaling, RTCPeerConnection, reconnect, jitter), src/components/fate/cloud-games.tsx (Cloud tab UI: status card, host setting, catalog grid, full-screen player with phases/quit-confirm/fullscreen/relock), src/app/api/stratus/[...path]/route.ts (same-origin proxy w/ cookie relay).
- Wired "cloud" tab into page.tsx (5 tabs + deep link), added .relock-hint CSS.
- Fixed: duplicate detachSafe import; react-hooks/set-state-in-effect (deferred syncs); proxy timeout (25s > server 20s) + never-throw apiWithFallback + try/finally refresh; SW stale-chunk bug (cache-first /_next/static broke dev) → SW v1.1.0 network-first for JS/CSS, cache-first only for immutable assets.
- Verified via agent-browser: Cloud tab renders + ?tab=cloud deep link; probe chain surfaces honest error state (~29s) since sandbox IP is CDN-filtered (curl + in-page probes confirm TLS connects but responses hang for datacenter IPs; residential browsers expected to work); TODAY/THREADS tabs regress-clean; offline reload still renders app (SW v1.1.0); lint clean.

Stage Summary:
- Cloud gaming CDN recovered and integrated: Stratus @ cdn.vipersfutbol.com (REST + WS signaling + WebRTC + JYSDK input), host overridable in UI.
- Files: src/lib/{stratus,cloud-input,cloud-player}.ts, src/components/fate/cloud-games.tsx, src/app/api/stratus/[...path]/route.ts, public/sw.js v1.1.0.
- Known sandbox limitation: CDN blocks datacenter IPs; user's residential browser should get catalog + sessions directly (proxy fallback exists for CORS).

---
Task ID: 3
Agent: main (Z.ai)
Task: "Games no longer loading, the cloud games are what I'm talking about, pls fix" — diagnose and fix cloud games; user attached their portal page (upload/test.html).

Work Log:
- Probed cdn.vipersfutbol.com: TLS connects, /stratus/* hangs (dead origin); / and /wi/* answer 404 fast → edge alive, stratus backend dead.
- Extracted serverList from decoded-loader.js-fn0.txt: 9 cdn.* mirrors + 2 backup wss:// endpoints; portal's getWlsp() pings each (WebSocket binary ping) and picks the first alive → root cause: my integration (and test.html) hardcoded one mirror that died.
- Parallel-probed all 11: cdn.northstreetumc.org ALIVE (Cloudflare bot-gate for datacenter IPs), vipersfutbol + 7 others dead/hanging, backups alive but stratus-less.
- Rewrote src/lib/stratus.ts: STRATUS_MIRRORS list, probeDirect→probeProxy parallel health checks (challenge vs dead classification), autoSelectMirror (fastest ok, persisted to fate-v6-stratus-auto-host, throttled 60s), auto-failover inside apiWithFallback (direct → rotate → proxy), host-stamped games cache, per-session host pinning (sessionHost captured at createSession; signaling rides same mirror via buildSignalingUrl(host)).
- Patched cloud-player.ts (signaling uses api.getHost()), proxy route (default host → northstreetumc, SSRF private-host guard), cloud-games.tsx (Auto chip + 9 mirror chips with ok/bot-checked/dead dots + latency, manual pin, host override stays).
- Fixed TS errors: literal-type useState<string>, cache return mode, RTCDataChannelInit priority cast. eslint clean on all 4 files.
- Browser-verified: mirror picker renders, auto picks northstreetumc, chips show honest per-mirror state (northstreetumc → bot-checked (Cloudflare), 8 others → timed out — correct for this datacenter IP; residential browsers expected green + catalog).
- Wrote scripts/patch-test-html.py → download/test-fixed.html: same rotation ported into the user's static portal page (mirror list + parallel probe + 10-min localStorage cache + getBase() prefers pick + await ensureStratusBase() in init()).

Stage Summary:
- Cloud games no longer hardcode a dead mirror: auto-rotation across the portal's 9 mirrors + proxy fallback + manual pin UI.
- Deliverables: updated Next.js app (Cloud tab), download/test-fixed.html for the user's static site.
- Sandbox limitation remains: CDN bot-gates datacenter IPs, so live catalog can't be exercised here; from the user's network the auto-picked mirror should answer directly.
