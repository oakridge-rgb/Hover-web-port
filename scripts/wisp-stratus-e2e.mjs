// Node shim wrapper: fake minimal web env, then boot the real transport.
const __argv = process.argv;
const __exit = (c) => process.exit(c);
const __cwd = process.cwd;
try { globalThis.process = undefined; } catch {}
globalThis.window = globalThis;
globalThis.document = {
  title: "shim",
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
  currentScript: null,
};
globalThis.XMLHttpRequest = class {
  open() {}
  setRequestHeader() {}
  addEventListener() {}
  removeEventListener() {}
  send() {}
};
globalThis.location = new URL("https://localhost/");

const { default: LibcurlClient } = await import("./curl-transport.mjs");

const WISP = __argv[2] || "wss://api.personalloanonline.net/ws/";
const TARGETS = [
  "https://api.personalloanonline.net/stratus/status",
  "https://api.personalloanonline.net/stratus/games",
  "https://athollcottage.com/stratus/status",
  "https://cdn.northstreetumc.org/stratus/status",
];

console.log(`[*] wisp lane: ${WISP}`);
const t = new LibcurlClient({ wisp: WISP });
console.log("[*] init() — libcurl wasm + wisp socket...");
await t.init();
console.log("[+] transport ready");

const BROWSER_HEADERS = [
  ["user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"],
  ["accept", "application/json, text/plain, */*"],
  ["accept-language", "en-US,en;q=0.9"],
];

for (const target of TARGETS) {
  try {
    console.log(`\n=== GET ${target} (via wisp) ===`);
    const res = await t.request(new URL(target), "GET", void 0, BROWSER_HEADERS, undefined);
    const body = res.body instanceof Uint8Array ? new TextDecoder().decode(res.body) : String(res.body ?? "");
    console.log(`status=${res.status} len=${body.length}`);
    console.log("body[:600]:", body.slice(0, 600));
  } catch (e) {
    console.log("ERR:", e?.message || String(e));
  }
}
__exit(0);
