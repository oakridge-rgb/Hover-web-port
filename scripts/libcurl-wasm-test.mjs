#!/usr/bin/env node
/** Run the portal's OWN LibcurlClient (libcurl-wasm + wisp) from Node and
 *  request /stratus/status through each alive mirror tunnel. */
import LibcurlClient from "/tmp/curl-transport.mjs";

const TARGETS = [
  ["cdn.pcesc.org", "https://cdn.vipersfutbol.com/stratus/status"],
  ["cdn.vipersfutbol.com", "https://cdn.vipersfutbol.com/stratus/status"],
  ["cdn.kcchallengevbc.com", "https://cdn.vipersfutbol.com/stratus/status"],
  ["cdn.pcesc.org", "https://cdn.pcesc.org/stratus/status"],
  ["cdn.pcesc.org", "https://example.com/"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [mirror, url] of TARGETS) {
  const t0 = Date.now();
  try {
    const t = new LibcurlClient({ wisp: `wss://${mirror}/` });
    const initTo = setTimeout(() => { throw new Error("init timeout"); }, 20000);
    await t.init();
    clearTimeout(initTo);
    const res = await t.request(new URL(url), "GET", null, [["accept", "application/json"]], undefined);
    const body = Buffer.from(res.body ?? "").toString().slice(0, 200).replace(/\s+/g, " ");
    console.log(`[${mirror} -> ${url}] ${Date.now() - t0}ms status=${res.status} body: ${body}`);
    try { t.session?.close?.(); } catch {}
  } catch (e) {
    console.log(`[${mirror} -> ${url}] FAILED ${Date.now() - t0}ms — ${String(e).slice(0, 200)}`);
  }
  await sleep(300);
}
process.exit(0);
