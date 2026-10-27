// Sweep: stratus/portal targets through both alive wisp lanes (per-request timeout).
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

const __argv = process.argv;
const __exit = (c) => process.exit(c);
try { globalThis.process = undefined; } catch {}

const { default: LibcurlClient } = await import("./curl-transport.mjs");

const LANES = ["wss://api.personalloanonline.net/ws/", "wss://athollcottage.com/connection/"];
const TARGETS = [
  "https://opium.best/",
  "https://opium.best/loader.js",
  "https://opium.best/stratus/status",
  "https://cdn.vipersfutbol.com/stratus/status",
  "https://cdn.northstreetumc.org/stratus/status",
  "https://cdn.pcesc.org/stratus/status",
  "https://cdn.kcchallengevbc.com/stratus/status",
  "https://cdn.slcbmooc.org/stratus/status",
  "https://cdn.topstargym.net/stratus/status",
  "https://cdn.goaplytexas.org/stratus/status",
  "https://cdn.clearfieldswimming.com/stratus/status",
  "https://cdn.richardacademy.cfd/stratus/status",
];

const HEADERS = [
  ["user-agent", "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"],
  ["accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"],
  ["accept-language", "en-US,en;q=0.9"],
];

async function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("req-timeout")), ms))]);
}

for (const lane of LANES) {
  console.log(`\n########## LANE ${lane} ##########`);
  const t = new LibcurlClient({ wisp: lane });
  await t.init();
  console.log("[lane ready]");
  for (const target of TARGETS) {
    try {
      const res = await withTimeout(t.request(new URL(target), "GET", void 0, HEADERS, undefined), 9000);
      let body = res.body;
      if (body && typeof body.getReader === "function") {
        const r = body.getReader(); const { value } = await r.read(); try { await r.cancel(); } catch {}
        body = value;
      }
      const text = body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body ?? "");
      console.log(`>>> ${target} -> ${res.status} len=${text.length}`);
      console.log("    ", JSON.stringify(text.slice(0, 220)));
    } catch (e) {
      console.log(`>>> ${target} -> ERR ${e?.message || e}`);
    }
  }
}
__exit(0);
