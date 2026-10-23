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
    for (; j < txt.length && j < i + 40000; j++) {
      const c = txt[j];
      if (c === "{") { depth++; started = true; }
      else if (c === "}") { depth--; if (started && depth === 0) { j++; break; } }
    }
    console.log(txt.slice(i, Math.min(j, i + 14000)));
    from = j; n++;
  }
}

extractFn("async function stratusApi", 1);
extractFn("function connectCloudSignaling", 1);
extractFn("function setCloudPhase", 1);
extractFn("function attemptCloudReconnect", 1);
extractFn("function teardownCloud", 1);
extractFn("function _quitCloudSession", 1);
// find wlspServer assignment
console.log("\n########## wlspServer refs ##########");
let i = 0, n = 0;
while (n < 6) {
  const k = txt.indexOf("wlspServer", i);
  if (k === -1) break;
  console.log("--- " + txt.slice(Math.max(0, k - 200), k + 260).replace(/\n/g, " "));
  i = k + 10; n++;
}
