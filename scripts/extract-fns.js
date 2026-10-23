#!/usr/bin/env node
const fs = require("fs");
const txt = fs.readFileSync("/home/z/my-project/scripts/decoded-main.js-fn0.txt", "utf8");

function extractFn(marker, openCh, closeCh, max = 1, label = "") {
  console.log("\n########## " + (label || marker) + " ##########");
  let from = 0, n = 0;
  while (n < max) {
    const i = txt.indexOf(marker, from);
    if (i === -1) break;
    // walk to balanced close
    let depth = 0, started = false, j = i;
    for (; j < txt.length && j < i + 30000; j++) {
      const c = txt[j];
      if (c === openCh) { depth++; started = true; }
      else if (c === closeCh) { depth--; if (started && depth === 0) { j++; break; } }
    }
    console.log(txt.slice(i, Math.min(j, i + 12000)));
    console.log("...");
    from = j; n++;
  }
  if (n === 0) console.log("(none)");
}

extractFn("function getBase", "{", "}", 2);
extractFn("async function loadCloudGames", "{", "}", 1);
extractFn("async function startCloudGame", "{", "}", 1);
