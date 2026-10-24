#!/usr/bin/env node
const fs = require("fs");
const txt = fs.readFileSync("/home/z/my-project/scripts/decoded-main.js-fn0.txt", "utf8");
const i = txt.indexOf("function setupCloudInput");
if (i === -1) { console.log("(setupCloudInput not found)"); process.exit(0); }
let depth = 0, started = false, j = i;
for (; j < txt.length && j < i + 60000; j++) {
  const c = txt[j];
  if (c === "{") { depth++; started = true; }
  else if (c === "}") { depth--; if (started && depth === 0) { j++; break; } }
}
const body = txt.slice(i, j);
fs.writeFileSync("/home/z/my-project/scripts/setup-cloud-input.txt", body);
console.log("captured", body.length, "chars -> scripts/setup-cloud-input.txt");
console.log(body.slice(0, 5200));
