// Single-shot wisp HTTP test: node wisp-one.mjs <lane> <url>
globalThis.window = globalThis;
globalThis.document = { title: "s", createElement: () => ({ style: {} }), currentScript: null };
globalThis.XMLHttpRequest = class { open() {} setRequestHeader() {} addEventListener() {} removeEventListener() {} send() {} };
globalThis.location = new URL("https://localhost/");

const __argv = process.argv;
const __exit = process.exit.bind(process);
try { globalThis.process = undefined; } catch {}

const { default: LibcurlClient } = await import("./curl-transport.mjs");
const lane = __argv[2] || "wss://api.personalloanonline.net/ws/";
const url = __argv[3] || "https://example.com/";
const t = new LibcurlClient({ wisp: lane });
const t0 = Date.now();
await t.init();
console.log(`[init ${Date.now() - t0}ms] lane=${lane}`);
try {
  const res = await Promise.race([
    t.request(new URL(url), "GET", void 0, [
      ["user-agent", "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"],
      ["accept", "*/*"],
    ], undefined),
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT-15s")), 15000)),
  ]);
  let body = res.body;
  if (body && typeof body.getReader === "function") {
    const r = body.getReader(); const { value } = await r.read(); try { await r.cancel(); } catch {}
    body = value;
  }
  const text = body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body ?? "");
  console.log(`[${Date.now() - t0}ms] status=${res.status} len=${text.length}`);
  console.log("headers:", JSON.stringify(res.headers).slice(0, 400));
  console.log("body:", JSON.stringify(text.slice(0, 300)));
} catch (e) {
  console.log(`[${Date.now() - t0}ms] ERR ${e?.message || e}`);
}
__exit(0);
