#!/usr/bin/env node
/** Syntax-check all inline <script> blocks of the built portal. */
const fs = require("fs");
const vm = require("vm");
const file = process.argv[2] || "/home/z/my-project/download/test-v4-arcade-network.html";
const html = fs.readFileSync(file, "utf8");
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0, bad = 0;
while ((m = re.exec(html))) {
  i++;
  const code = m[1];
  if (!code.trim()) continue;
  try {
    new vm.Script(code, { filename: `block-${i}.js` });
    console.log(`block ${i}: OK (${code.length} bytes)`);
  } catch (e) {
    bad++;
    console.log(`block ${i}: SYNTAX ERROR -> ${e.message}`);
    const ln = (e.stack.match(/block-\d+\.js:(\d+)/) || [])[1];
    if (ln) {
      const lines = code.split("\n");
      console.log("  context: " + (lines[ln - 1] || "").slice(0, 200));
    }
  }
}
console.log(bad ? `${bad} BAD BLOCK(S)` : "ALL BLOCKS OK");
process.exit(bad ? 1 : 0);
