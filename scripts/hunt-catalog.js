#!/usr/bin/env node
/** Hunt a Stratus up-window: retry the proxy lane every ~15s for several rounds; save catalog on 200. */
const fs = require("fs");

const MIRRORS = [
  "cdn.northstreetumc.org",
  "cdn.goaplytexas.org",
  "cdn.slcbmooc.org",
  "cdn.vipersfutbol.com",
  "cdn.topstargym.net",
];
const PROXY = (host, path) => `http://localhost:3000/api/stratus/${path}?host=${host}`;
const OUT = "/home/z/my-project/scripts/stratus-catalog-seed.json";

async function tryOnce(mirror, path) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 24000);
    const res = await fetch(PROXY(mirror, path), { signal: ctl.signal });
    clearTimeout(t);
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: String(e && e.message || e) };
  }
}

(async () => {
  for (let round = 1; round <= 8; round++) {
    const stamp = new Date().toISOString().slice(11, 19);
    const results = await Promise.all(MIRRORS.map(async (m) => {
      const r = await tryOnce(m, "status");
      return `${m.slice(4, 14)}:${r.status}`;
    }));
    console.log(`[${stamp}] round ${round} status codes:`, results.join("  "));

    // any 200 on status -> immediately grab games from same mirror
    const hit = MIRRORS.find(async () => false); // placeholder
    for (const m of MIRRORS) {
      const r = await Promise.resolve(null);
    }
    // simple sequential check for a 200 (parse from results)
    const okMirror = results
      .map((s, i) => ({ code: s.split(":")[1], m: MIRRORS[i] }))
      .find((x) => x.code === "200");
    if (okMirror) {
      console.log(`[${stamp}] UP WINDOW on ${okMirror.m}! fetching games...`);
      const g = await tryOnce(okMirror.m, "games");
      if (g.status === 200 && g.text.includes("game_key")) {
        fs.writeFileSync(OUT, g.text);
        console.log(`[${stamp}] CATALOG SAVED: ${g.text.length} bytes -> ${OUT}`);
        process.exit(0);
      }
      console.log(`[${stamp}] games fetch gave ${g.status}, continuing hunt...`);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  console.log("HUNT FAILED: no up-window found in 8 rounds. Backend is down hard right now.");
  process.exit(2);
})();
