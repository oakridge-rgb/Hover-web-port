FATE MOVIES 2.0 — upload list
=============================

UPLOAD THIS 1 FILE to your site root:
  movies.html     — the whole page is one file (HTML + CSS + JS)

That's it. No other files, no API keys, nothing to configure.

WHAT IT IS
  Real streaming search: every movie & show on demand.
  - Trending / Top Rated / Newest catalogs + 18 genre filters,
    Movies and Series toggle, infinite scroll
  - Search anything (movies + series at once)
  - Detail popups: backdrop, poster, year, IMDb rating, runtime,
    genres, cast, description
  - PLAY: 3 providers (Vidlink, Vidsrc.to, Vidsrc.xyz) — one tap to
    switch if a stream is dead. Series get a season + episode picker
    with real episode names.
  - Continue Watching strip (remembers where you stopped, even the
    exact episode)

WHY TMDB IS NOT NEEDED (the school fix)
  The catalog + search run on **Cinemeta** (Stremio's metadata API,
  v3-cinemeta.strem.io) — a completely different domain from TMDB,
  no API key, so school filters that block TMDB don't touch it.
  Posters come from images.metahub.space (also not TMDB).
  Triple fallback if a network still gets in the way:
    1. 24h localStorage cache — anything you (or anyone) loaded
       before keeps working even fully offline
    2. automatic retry on slow/cold requests
    3. baked-in offline picks — if the API is unreachable the page
       still opens with ~40 playable classics instead of a dead page
       (green/red chip under the title tells you which mode it's in;
       a Retry button appears when offline)

  Players are embeds by IMDb id (vidlink.pro / vidsrc.to /
  vidsrc.xyz) — same as every big streaming portal uses.

COMPAT
  - Same password gate as games.html (fate_v6_auth session — nobody
    gets logged out; not logged in -> bounced to index.html)
  - Same panic key (reads your existing panic key setting,
    default https://clever.com) and Escape closes modals
  - If theme.js exists at root (V7 pack), the page follows all 10
    themes including particles. If not, it runs in original amber.
  - If countdown.js exists at root, the launch banner shows here too.
  - Both includes are optional — 404s are harmless.

WANT A LINK TO IT FROM OTHER PAGES?
  Add one line to any page's nav or fab menu:
    <a href="movies.html">Movies</a>
  (or a matching fab-item like the others)

NOTES
  - Playback quality depends on the provider sources at any moment;
    that's why there are 3 of them — switching is instant.
  - The green "Catalog: Cinemeta — live" chip = API reachable. If a
    school ever blocks Stremio too, the chip turns red and the page
    goes offline-picks mode; tell me and I'll wire the jet tunnel
    in as an extra fetch rung.
