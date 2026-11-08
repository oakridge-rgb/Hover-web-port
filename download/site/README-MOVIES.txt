FATE MOVIES 2.4 — LIVE TMDB: every movie & show (the milkbox method)
================================================================================
WHAT'S NEW
  You said: "we need a way to fetch every movie like tmdb, and
  milkbox.japan.is has that method". Correct — MILKBOX's own app.js ships a
  PUBLIC TMDB v4 read token and calls api.themoviedb.org/3 with it. v2.4
  reuses that exact method, plus a tunnel for blocked networks:

  DATA LANES (see the chip under the title — click it to toggle)
    1. DIRECT   browser fetch straight to api.themoviedb.org (CORS:* —
                works wherever TMDB isn't blocked).
    2. WISP     if TMDB is blocked (school wifi), the same request goes out
                as a RAW HTTP/1.1 GET to api.themoviedb.org:80 THROUGH the
                FATE wisp tunnel — token header intact — hopping the 8
                engine lanes until one answers. The winning lane is sticky
                (saved on the device). Verified live: lane "linuxontab ·
                fly" carried /trending/all/day end-to-end.
    Both lanes share a 6-hour device cache, so even a total outage keeps
    everything you already browsed. Posters load from image.tmdb.org and
    fall back to the wsrv.nl mirror on error.

  WHAT YOU GET (all live, infinite scroll to 25 pages per view)
    - Trending / Top Rated / Newest for BOTH Movies and Series.
    - Every TMDB genre as a pill (Action ... War & Politics) = discover.
    - Search hits ALL of TMDB (movies + shows, multi-search).
    - Detail sheets: backdrop, rating, certification (R/PG-13...), runtime
      or seasons, genres, top cast, "More like this" row.
    - TV: full season picker + episode list (names, air dates) — click any
      episode and it plays immediately on your server ring.
    - Everything still plays through chips 1-2: VidZee (peak) and
      MILKBOX · x8rr — every TMDB title feeds them its TMDB id.
    - The 1247-title on-device catalog is still there as the "Vault"
      pill: fully offline, instant, always available. When every TMDB lane
      is down the page boots into the vault by itself.

  TMDB LANE STATUS / TOOLS
    - The chip under the header shows the live lane at all times.
    - Sites vault -> "TMDB data lane": Test TMDB lane (probes direct,
      then the tunnel, saves what works) + Clear TMDB cache.

UPLOAD LIST v2.4 (site root)
  1. movies.html         101 KB  (replaces the old one)
  2. fate-movies-cat.js  unchanged | 3. msheets/ unchanged | 4. gn-math.html unchanged
  (index.html unchanged from 2.3)

VERIFIED ON 2026-11-09 (real browser, both lanes)
  Direct lane: trending 20 cards + posters in ~2s, genre discover, search
  "dune" -> 13 hits, detail sheet w/ cast+cert+recs, VisionQuest S1E1-8
  listed, VidZee frame built as /embed/tv/213375/1/1, vault pill renders
  sprites, scroll paging 20->60. Wisp lane: pref forced -> tunnel carried
  the catalog (sticky "linuxontab · fly"), 20 cards via raw HTTP. Zero
  console errors on both.

================================================================================

PREVIOUS (v2.3)

WHAT CHANGED AND WHY
  You said: don't pack movie stuff into the single-file FATE.html anymore —
  make a separate movie page, and use the sources that work for you:
  x8rr → server 1 "VidZee (peak) Primary", and milky.japan.is (MILKBOX),
  which is not blocked on your network. So v2.3 is a standalone page that
  builds both of those in as the top of everything.

PLAYER RING (in-page player, per title)
  1. VidZee (peak) ★      player.vidzee.wtf  — YOUR confirmed primary.
     TMDB-id embeds: /embed/movie/{id} and /embed/tv/{id}/{s}/{e}.
  2. MILKBOX · x8rr ★     milky.japan.is — NOT blocked for you. The chip
     opens MILKBOX's own player (/movie/{id}, /tv/{id}) which carries the
     "x8rr Movies (Direct Stream / Ad-Free HLS)" server — verified live:
     opening Dune on the chip showed the x8rr MOVIES HLS badge connecting.
  3-8. The v2.2 verified six: VidSpark (vidsrc.pm), CineSrc, YapGrid,
     2Embed, Vidlink, Vidlink IMDb.
  Dead streams still auto-hop to the next chip after 12 seconds.

SITES VAULT (nav "Sites" / fab "Sites vault" / Escape closes)
  - ★ Confirmed by you: MILKBOX, VidZee (peak), and the x8rr/movies repo.
  - ✅ Working on the FATE wisp: the 32 sites that answered real HTTP on
    Nov 8 through the engine's own wisp client (Aether, Cinejoy, 7Movies,
    Atlantic, Vivarium, CineLite, Ghostflix, MeowTV, Reelix, Cno, SweetFox,
    Cinecat, Flixer, Dulo, Basement, ShuttleTV, TonkaCine, Moovie, Cineby,
    PrimeShows, PressPlayZ, LookMovie, Goojara, Levidia, 1Shows, ArrowTV,
    AniCine, MegaCartoons, SuperCartoons, HiAnime, Aetheris, Moxy).
    Each card: Engine / Direct / ✓ / ✗ — marks persist on the device.
  - ⚠ Bot-walled: 11 more that answer but throw a Cloudflare/verify wall
    first (PopcornMovies, Chillflix, NEPU, RidoMovies, HydraHD, ZetMoon,
    WCOStream, MoanaTV, FlyStream, AZMovies, Noxx).
  - 🛰 Wisp lanes: the 8 fastest endpoints from the Nov 8 scan with a live
    "Probe lanes" button — it opens the engine's wisp client right on the
    page and measures a real HTTP round-trip per lane.
  - ⚙ Engine: "Engine" opens go to gn-math.html#open=<site url>, the same
    deep link the FATE Apps module uses. Keep gn-math.html next to this
    page — or paste any hosted engine URL in the vault and hit Save.

UPLOAD LIST (site root — this is now a SEPARATE page, FATE.html untouched)
  1. movies.html          74 KB  (replaces the old one)
  2. fate-movies-cat.js  222 KB  (unchanged from 2.2 if already uploaded)
  3. msheets/  13 jpg            (unchanged from 2.2 if already uploaded)
  4. gn-math.html                  (already in your site root — Engine opens)
  index.html got one new side-rail link (Movies) — re-upload it too.

VERIFIED ON 2026-11-09 (real browser)
  Gate → catalog on-device 1247 titles · search instant · Dune plays on
  VidZee chip (player.vidzee.wtf/embed/movie/438631) · MILKBOX chip shows
  the x8rr MOVIES HLS server · vault 3+32+11 cards render · lane probe
  returns live ms · ✓/✗ marks survive reload · zero console errors.

RE-TESTING SITES LATER
  The vault's ✓/✗ is per device. To re-scan all lanes/sites from a PC:
  node scripts/wisp_site_test.js endpoints && node scripts/wisp_site_test.js sites
