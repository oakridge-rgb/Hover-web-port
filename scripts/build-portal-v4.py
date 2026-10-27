#!/usr/bin/env python3
"""Build portal v4: wire the LIVE GitHub game network (ckv / ugs / seraph / gn-math
via jsDelivr, multi-edge fallback) into the v3 portal (which keeps the full cloud
stack: 27-lane sweep + mirror self-test + persistent retry).

Source of truth: opium portal main.js decoded payload (scripts/out/main-v2-payload-1-eval.js):
  OPMSOURCES.ckv.index = <gh>/%54ongSherbet/storage@main/ckv.json
  OPMSOURCES.ugs.index = <gh>/%54ongSherbet/storage@main/ugs.json
  GMSHELF.seraph.index = <gh>/gmshelf/seraph/seraph.json     (base + url)
  GNM.index            = <gh>/freebuisness/assets/zones.json ({HTML_URL}/{COVER_URL})
  game url             = <gh>/<author>/<file>; cover = <gh>/<cover_author>/<cover_file>
All verified HTTP 200 from sandbox on cdn/fastly/gcore/testingcf jsDelivr edges.
"""
import sys

SRC = "/home/z/my-project/download/test-v3-cloud-reload.html"
DST = "/home/z/my-project/download/test-v4-arcade-network.html"

with open(SRC, "r", encoding="utf-8") as f:
    t = f.read()

def rep(old, new, label):
    global t
    n = t.count(old)
    if n != 1:
        print(f"FAIL [{label}]: expected 1 occurrence, found {n}")
        sys.exit(1)
    t = t.replace(old, new)
    print(f"ok   [{label}]")

# ---------------------------------------------------------------- P1: head stamp
rep("<!-- FATE PORTAL BUILD v3 (2026-10-27) : 27-lane sweep + mirror self-test + persistent retry -->",
    "<!-- FATE PORTAL BUILD v4 (2026-10-27) : arcade GitHub network (ckv+ugs+seraph+gn-math via jsDelivr multi-edge) + full v3 cloud stack -->",
    "head stamp")

# ---------------------------------------------------------------- P2: console + footer stamps
rep("[FATE PORTAL v3] cloud stack build 2026-10-27",
    "[FATE PORTAL v4] arcade network + cloud stack build 2026-10-27",
    "console marker")
rep("[FATE PORTAL v3] sweep failed everywhere",
    "[FATE PORTAL v4] sweep failed everywhere",
    "seed warn tag")
rep("[FATE PORTAL v3] auto-retry:",
    "[FATE PORTAL v4] auto-retry:",
    "retry log tag")
rep("cloud build v3 — 2026-10-27 (27-lane sweep + self-test)",
    "cloud build v4 — arcade network live + 27-lane sweep + self-test",
    "footer chip v3-emdash")

# ---------------------------------------------------------------- P3: CDN_SOURCES
OLD_SOURCES = """// ============================================
// MULTI-CDN GAME SOURCES — fetched in parallel
// ============================================
const CDN_SOURCES = [
  {
    name: 'local',
    url: 'games.json'
  },
  {
    name: 'local2',
    url: 'games3.json'
  }
];"""

NEW_SOURCES = """// ============================================
// MULTI-CDN GAME SOURCES — fetched in parallel
// v4: added the LIVE GitHub game network recovered from the opium portal build
// (ckv 847 + ugs 1511 + seraph 501 + gn-math ~849 entries, ~3.3k unique after
// dedupe). Indexes are fetched with jsDelivr multi-edge fallback; whichever
// edge answers the index also serves that source's game files + covers
// (src._gh), so a blocked edge degrades instead of killing the source.
// Verified live 2026-10-27: all 4 indexes + sample game/cover files HTTP 200.
// ============================================
const GH_EDGES = ['https://cdn.jsdelivr.net/gh/', 'https://fastly.jsdelivr.net/gh/', 'https://gcore.jsdelivr.net/gh/', 'https://testingcf.jsdelivr.net/gh/'];
const GH_MAIN = GH_EDGES[0];
const ghUrls = (path) => GH_EDGES.map(e => e + path);
const ckvUgsTransform = (data, src) => (Array.isArray(data) ? data : []).filter(t => t && t.name && t.author && t.file).map(t => ({
  name: t.name,
  url: (src._gh || GH_MAIN) + t.author + '/' + t.file,
  img: (t.cover_author && t.cover_file) ? (src._gh || GH_MAIN) + t.cover_author + '/' + t.cover_file : ''
}));
const CDN_SOURCES = [
  {
    name: 'local',
    url: 'games.json'
  },
  {
    name: 'local2',
    url: 'games3.json'
  },
  {
    name: 'ckv',
    urls: ghUrls('%54ongSherbet/storage@main/ckv.json'),
    transform: ckvUgsTransform
  },
  {
    name: 'ugs',
    urls: ghUrls('%54ongSherbet/storage@main/ugs.json'),
    transform: ckvUgsTransform
  },
  {
    name: 'seraph',
    urls: ghUrls('gmshelf/seraph/seraph.json'),
    ghPath: 'gmshelf/seraph',
    transform: (data) => (Array.isArray(data) ? data : []).filter(t => t && t.name && t.url).map(t => ({
      name: t.name,
      url: t.url,
      img: /placeholder/i.test(t.img || '') ? '' : (t.img || '')
    }))
  },
  {
    name: 'gnm',
    urls: ghUrls('freebuisness/assets/zones.json'),
    ghPath: 'freebuisness/',
    replacementsGh: { '{HTML_URL}': 'freebuisness/html', '{COVER_URL}': 'freebuisness/covers' },
    transform: (data) => (Array.isArray(data) ? data : []).filter(t => t && t.name && t.url && (t.url || '').indexOf('{HTML_URL}') === 0 && !(t.name || '').startsWith('[!]')).map(t => ({
      name: t.name,
      url: t.url,
      img: t.cover || ''
    }))
  }
];"""

rep(OLD_SOURCES, NEW_SOURCES, "CDN_SOURCES block")

# ---------------------------------------------------------------- P4: init() fetch loop (edge fallback + transform)
OLD_FETCH = """  const results = await Promise.allSettled(
    CDN_SOURCES.map(async (src) => {
      try {
        const res = await fetchWithTimeout(src.url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data.games || []);
        const mapped = raw.map((g, i) => ({"""

NEW_FETCH = """  const results = await Promise.allSettled(
    CDN_SOURCES.map(async (src) => {
      try {
        // v4: multi-edge fallback (src.urls) + remember the winning gh edge so
        // game files + covers ride the same edge that answered the index
        let data = null, lastErr = null;
        for (const u of (src.urls || [src.url])) {
          try {
            const res = await fetchWithTimeout(u);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
            const p = u.indexOf('/gh/');
            if (p > -1) src._gh = u.slice(0, p + 4);
            console.log(`[FATE CDN] ${src.name}: index OK via ${u}`);
            break;
          } catch (e) { lastErr = e; }
        }
        if (!data) throw (lastErr || new Error('all edges failed'));
        if (src._gh) {
          if (src.ghPath) src.base = src._gh + src.ghPath;
          if (src.replacementsGh) {
            src.replacements = {};
            Object.keys(src.replacementsGh).forEach(k => { src.replacements[k] = src._gh + src.replacementsGh[k]; });
          }
        }
        const raw = src.transform ? src.transform(data, src) : (Array.isArray(data) ? data : (data.games || []));
        const mapped = raw.map((g, i) => ({"""

rep(OLD_FETCH, NEW_FETCH, "init fetch loop")

with open(DST, "w", encoding="utf-8") as f:
    f.write(t)

print(f"\nwrote {DST} ({len(t)} bytes)")
