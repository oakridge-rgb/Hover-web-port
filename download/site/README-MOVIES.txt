FATE MOVIES 2.3 — the separate movie page (your confirmed servers + site vault)
================================================================================
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
