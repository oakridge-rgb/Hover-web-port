Here are all the generated files.

## Which file should I deploy? (2026-10-27)

**`test-v3-cloud-reload.html`** — this is the one. It is the user's portal
(`upload/test.html`) carrying the complete cloud stack:

- v2 base: 9-mirror parallel sweep, retry ladder (GET x3 / POST x2),
  saved-catalog fallback that never blanks the grid, non-blocking init,
  Reload games button, 20 s background auto-retry
- v3 additions (after the "all 9 mirrors found nothing" report):
  - **27-lane sweep**: 9 mirrors x (direct + codetabs + allorigins public
    proxies) — more vantage points to catch the backend's up-windows, and
    the public-proxy lanes keep working when a school network blocks the
    cdn.* domains
  - **Check mirrors** self-test button: probes every mirror directly and
    through both public proxies, shows a per-mirror table (backend UP /
    CF bot-gate / HTTP 5xx origin dead / timeout / blocked) plus a verdict
    line telling you whether the problem is your network or the origin
  - persistent auto-retry (~5 h at 25 s) with a "cloud games are back"
    status ping when a retry lands
  - build markers so you can verify the deployment: view-source shows
    `FATE PORTAL BUILD v3 (2026-10-27)` near `</head>`, console shows
    `[FATE PORTAL v3] cloud stack build 2026-10-27`, footer chip reads
    `cloud build v3 — 2026-10-27 (27-lane sweep + self-test)`

Deploy: rename to `test.html`, replace the old file on the site, then
**Ctrl+Shift+R** to hard-refresh.

Older files kept for reference: `fate-portal-v2.html` (v2 stack, same code
without the v3 additions), `test-fixed.html` (Task-3 era, outdated).

## Note on the CDN itself (2026-10-27 diagnosis)

The Stratus cloud-gaming backend flaps in and out (verified across four
independent vantage points: direct, same-origin proxy, codetabs, allorigins
— and Cloudflare returned 522/502 "origin unreachable" from the public
proxies too). When the origin is down, NO client can load the catalog; the
portal keeps retrying and fills in by itself when the backend returns.
Use **Check mirrors** in the Cloud section to see the live per-mirror state
from your own network.
