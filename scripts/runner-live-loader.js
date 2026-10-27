#!/usr/bin/env node
/** Execute the NEW live loader with instrumented globals; capture WS/URL dials & defined globals. */
const fs = require("fs");
const vm = require("vm");

const src = fs.readFileSync("/tmp/live-loader-now.js", "utf8");
const log = [];

function makeWS() {
  return class FakeWebSocket {
    constructor(url, ...rest) {
      log.push(`WS dial: ${url}`);
      this.url = url;
      this.readyState = 0;
      // act dead: never open, fire onerror async so loader moves on
      setTimeout(() => { this.onerror && this.onerror(new Error("blocked")); this.onclose && this.onclose({}); }, 5);
    }
    send(d) { log.push(`WS send: ${typeof d === "string" ? d.slice(0, 80) : "bin(" + (d && d.length) + ")"}`); }
    close() {}
  };
}

const UNI = new Proxy(function () {}, {
  get(t, p) {
    if (p === Symbol.toPrimitive) return () => "";
    if (p === "toString" || p === "valueOf") return () => "";
    return UNI;
  },
  apply() { return UNI; },
  construct() { return UNI; },
  has() { return true; },
});

const defined = {};
const sandbox = {
  console: { log: (...a) => log.push("console.log: " + a.join(" ").slice(0, 300)) },
  JSON, Math, Promise, Date, Array, Object, String, Number, Boolean, RegExp, Error,
  Symbol, Map, Set, Reflect, Proxy, parseInt, parseFloat, isNaN,
  encodeURIComponent, decodeURIComponent,
  Uint8Array, Uint16Array, Uint32Array, Int8Array, Int32Array, Float32Array, Float64Array,
  ArrayBuffer, DataView, TextEncoder, TextDecoder, URL, URLSearchParams,
  setTimeout: (fn) => { try { fn(); } catch {} return 0; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  queueMicrotask: (fn) => { try { fn(); } catch {} },
  WebSocket: makeWS(),
  fetch: (u, o) => { log.push(`fetch: ${u} ${o ? JSON.stringify(o).slice(0, 120) : ""}`); return Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}), text: () => Promise.resolve("") }); },
  Function: (...a) => { log.push(`Function(): ${String(a[a.length - 1]).slice(0, 200)}`); const f = function () {}; return f; },
  window: UNI, document: UNI, navigator: UNI, location: UNI, localStorage: UNI,
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

// record everything the loader defines on globalThis
const ctx = vm.createContext(sandbox);
try {
  vm.runInContext(src, ctx, { filename: "loader.js", timeout: 20000 });
} catch (e) {
  log.push(`EVAL ERROR: ${e.message.slice(0, 300)}`);
}

console.log("=== DIALS / EVENTS ===");
log.slice(0, 60).forEach((l) => console.log(l));
console.log("\n=== GLOBALS DEFINED BY LOADER ===");
console.log(Object.keys(sandbox).filter((k) => !["console","JSON","Math","Promise","Date","Array","Object","String","Number","Boolean","RegExp","Error","Symbol","Map","Set","Reflect","Proxy","parseInt","parseFloat","isNaN","encodeURIComponent","decodeURIComponent","Uint8Array","Uint16Array","Uint32Array","Int8Array","Int32Array","Float32Array","Float64Array","ArrayBuffer","DataView","TextEncoder","TextDecoder","URL","URLSearchParams","setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","WebSocket","fetch","Function","atob","btoa","globalThis","self"].includes(k)).join(", ") || "(none)");
