#!/usr/bin/env node
const fs = require("fs");
const txt = fs.readFileSync("/home/z/my-project/scripts/decoded-main.js-fn0.txt", "utf8");

function show(needle, ctx = 260, max = 8) {
  console.log("\n########## " + needle + " ##########");
  let idx = 0, n = 0;
  while (n < max) {
    const i = txt.indexOf(needle, idx);
    if (i === -1) break;
    console.log("---");
    console.log(txt.slice(Math.max(0, i - ctx), i + ctx).replace(/\n/g, " "));
    idx = i + needle.length;
    n++;
  }
  if (n === 0) console.log("(none)");
}

show("clearfieldswimming", 300, 5);
show("uwgraduation", 300, 5);
show("liolicnuts", 300, 4);
show("aether.ist", 300, 4);
show("nowgg.fun", 300, 4);
show("geforcenow", 200, 3);
show("new WebSocket", 350, 6);
show("async function startCloud", 400, 2);
show("cloudGames", 200, 6);
