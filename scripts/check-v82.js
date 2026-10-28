const fs = require('fs');
const html = fs.readFileSync('/home/z/my-project/download/test-v8-jet-lane.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log('script blocks:', blocks.length);
let ok = true;
blocks.forEach((b, i) => {
  try { new Function(b); console.log(`block ${i}: OK (${b.length} chars)`); }
  catch (e) { ok = false; console.log(`block ${i}: FAIL ${e.message}`); }
});
const sw = fs.readFileSync('/home/z/my-project/download/fate-sw.js', 'utf8');
try { new Function(sw); console.log(`fate-sw.js: OK (${sw.length} chars)`); }
catch (e) { ok = false; console.log('fate-sw.js: FAIL ' + e.message); }
/* sanity: key v8.2 functions present */
for (const fn of ['fateSwReset', 'fateSwAlive', 'fateSwWatch', 'fateJetStage', 'setupMessagePort', 'fateWarmingN', 'handshake']) {
  const hit = html.includes(fn) || sw.includes(fn);
  console.log(`marker ${fn}: ${hit ? 'present' : 'MISSING'}`);
  if (!hit) ok = false;
}
process.exit(ok ? 0 : 1);
