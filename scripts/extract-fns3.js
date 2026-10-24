#!/usr/bin/env node
const fs = require("fs");
const txt = fs.readFileSync("/home/z/my-project/scripts/decoded-main.js-fn0.txt", "utf8");

function extractFn(marker, max = 1) {
  console.log("\n########## " + marker + " ##########");
  let from = 0, n = 0;
  while (n < max) {
    const i = txt.indexOf(marker, from);
    if (i === -1) { if (!n) console.log("(none)"); break; }
    let depth = 0, started = false, j = i;
    for (; j < txt.length && j < i + 60000; j++) {
      const c = txt[j];
      if (c === "{") { depth++; started = true; }
      else if (c === "}") { depth--; if (started && depth === 0) { j++; break; } }
    }
    console.log(txt.slice(i, Math.min(j, i + 16000)));
    from = j; n++;
  }
}

extractFn("async function createCloudPeer", 1);
extractFn("function showCloudEndedScreen", 1);
extractFn("function _flushPendingCandidates", 1);
// input message format hints
console.log("\n########## dc.send / datachannel messages ##########");
let i = 0, n = 0;
while (n < 12) {
  const k = txt.indexOf("_cloudDc.send", i);
  if (k === -1) break;
  console.log("--- " + txt.slice(Math.max(0, k - 160), k + 240).replace(/\n/g, " "));
  i = k + 14; n++;
}
