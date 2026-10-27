#!/usr/bin/env node
/** Hunt v2: catch a Stratus up-window. Unbuffered file log, anomaly tracking,
 *  3 lanes (proxy / allorigins / codetabs) x 9 mirrors, saves catalog on 200. */
const fs = require("fs");

const MIRRORS = [
  "cdn.northstreetumc.org",
  "cdn.vipersfutbol.com",
  "cdn.pcesc.org",
  "cdn.kcchallengevbc.com",
  "cdn.slcbmooc.org",
  "cdn.topstargym.net",
  "cdn.goaplytexas.org",
  "cdn.clearfieldswimming.com",
  "cdn.richardacademy.cfd",
];
const LOG = "/home/z/my-project/scripts/hunt-catalog.log";
const OUT = "/home/z/my-project/scripts/stratus-catalog-seed.json";

function say(line) {
  fs.appendFileSync(LOG, new Date().toISOString().slice(11, 19) + " " + line + "\n");
}

async function timedFetch(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    return { status: 0, text: String((e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

function lanesFor(host, path) {
  const target = "https://" + host + "/stratus/" + path;
  return [
    ["proxy", "http://localhost:3000/api/stratus/" + path + "?host=" + host],
    ["allorigins", "https://api.allorigins.win/raw?url=" + encodeURIComponent(target)],
    ["codetabs", "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(target)],
  ];
}

(async () => {
  say("HUNT START (15 rounds x 20 s, 3 lanes x 9 mirrors)");
  for (let round = 1; round <= 15; round++) {
    let summary = [];
    const anomalies = [];

    const tasks = [];
    for (const m of MIRRORS) {
      for (const [lane, url] of lanesFor(m, "status")) {
        tasks.push(
          timedFetch(url, 20000).then((r) => {
            if (r.status === 200) anomalies.push({ m, lane, status: 200, body: r.text.slice(0, 300) });
            else if (r.status !== 0 && r.status !== 502) anomalies.push({ m, lane, status: r.status });
            return m + "/" + lane + ":" + r.status;
          })
        );
      }
    }
    summary = await Promise.all(tasks);
    say("round " + round + ": " + summary.filter((s) => !s.endsWith(":0") && !s.endsWith(":502")).join(" ") || "all timeout/502");
    for (const a of anomalies) say("  ANOMALY " + a.lane + " " + a.m + " -> " + a.status + (a.body ? " " + a.body.slice(0, 120) : ""));

    // chase any 200: fetch games from that mirror via the same lane
    const hit = anomalies.find((a) => a.status === 200);
    if (hit) {
      say("UP WINDOW on " + hit.m + " via " + hit.lane + "! grabbing games...");
      const [lane, url] = lanesFor(hit.m, "games").find(([l]) => l === hit.lane);
      const g = await timedFetch(url, 25000);
      if (g.status === 200 && g.text.includes("game_key")) {
        fs.writeFileSync(OUT, g.text);
        say("CATALOG SAVED: " + g.text.length + " bytes");
        process.exit(0);
      }
      say("games fetch gave " + g.status + " " + g.text.slice(0, 100) + " — continuing");
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
  say("HUNT ENDED: no up-window in 15 rounds (~7 min). Origin down throughout.");
})();
