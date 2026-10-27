# Fate Portal builds

## Which file should I deploy? (2026-10-27)

**`test-v4-arcade-network.html`** — this is the one. It is the user's portal
(`upload/test.html`) carrying the FULL v3 cloud stack **plus the new v4
arcade network**:

### v4 additions — the live GitHub game network (~2,400 games)

Recovered by decoding the opium portal's new build (`main.js` 736 KB →
147 KB plaintext payload). The games no longer depend on the dead Stratus
origin at all — they are static HTML5 games served from GitHub repos
through jsDelivr, and **all of it is verified live** (every index, sample
game file and cover returned HTTP 200 on build day):

| Source | Index | Games repo | Loaded |
|--------|-------|-----------|--------|
| ckv | `gh/%54ongSherbet/storage@main/ckv.json` | `gmshelf/ckv` | 843 |
| ugs | `gh/%54ongSherbet/storage@main/ugs.json` | `bubbls/ugs-singlefile` | 1,150 |
| seraph | `gh/gmshelf/seraph/seraph.json` | `gmshelf/seraph` | 223 |
| gn-math | `gh/freebuisness/assets/zones.json` | `freebuisness/html` + covers | 197 |

Resilience built in:

- **Multi-edge fallback**: each index is tried on cdn → fastly → gcore →
  testingcf `.jsdelivr.net`; whichever edge answers the index also serves
  that source's game files + covers, so one blocked edge degrades instead
  of killing the source
- Existing CDN provider picker (GCore / Fastly / Statically / githack /
  gh-proxy / self-host) already works on the new games — they are plain
  `cdn.jsdelivr.net/gh/...` URLs
- Local catalogs (`games.json`, `games3.json`) still load first and keep
  priority in the dedupe

### Cloud section — unchanged from v3

- 27-lane sweep (9 mirrors x direct + codetabs + allorigins), Reload
  games button, Check mirrors self-test (~30 s parallel), persistent
  auto-retry (~5 h), seed-catalog slot
- Stratus mirrors are UNCHANGED (re-verified by decoding the fresh
  loader.js: same 9 `cdn.*` + 2 wss backups) — the origin still flaps;
  cloud games merge in automatically when it answers

### Verify your deployment

- view-source near `</head>`: `FATE PORTAL BUILD v4 (2026-10-27)`
- console: `[FATE PORTAL v4] arcade network + cloud stack build 2026-10-27`
  plus per-source lines `[FATE CDN] ckv: 847 games` etc.
- footer chip: `cloud build v4 — arcade network live + 27-lane sweep + self-test`
- header chip should read **2413 games** (2,413 with local catalogs absent;
  more on your site if `games.json`/`games3.json` exist)

Deploy: rename to `test.html`, replace the old file on the site, then
**Ctrl+Shift+R** to hard-refresh.

### E2E verified from the sandbox (2026-10-27)

- 2,413 unique games loaded; search + filters + lazy covers work
- Subway Surfers and 1v1.lol launched from `gh/gmshelf/ckv/...` inside the
  player (loader hidden, no error state)
- Cloud view intact and honest (origin still down → "No cloud games found",
  Reload + Check mirrors ready)

Older files kept for reference: `test-v3-cloud-reload.html` (v3 stack, no
arcade network), `fate-portal-v2.html` (v2), `test-fixed.html` (Task-3 era).

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
