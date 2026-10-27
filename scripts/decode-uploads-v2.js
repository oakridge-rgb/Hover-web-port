#!/usr/bin/env node
/** Decode the freshly-uploaded obfuscated files (loader.js + main.js).
 *  Runs each in a VM sandbox with instrumented eval/Function/fetch/WebSocket,
 *  captures every payload string, dumps to scripts/out/, logs network dials. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const OUT = "/home/z/my-project/scripts/out";
fs.mkdirSync(OUT, { recursive: true });

function makeWS(log) {
  return class FakeWebSocket {
    constructor(url, ...rest) {
      log.push(`WS dial: ${url}`);
      this.url = url; this.readyState = 0;
      setTimeout(() => { try { this.onerror && this.onerror(new Error("blocked")); this.onclose && this.onclose({}); } catch {} }, 5);
    }
    send(d) { log.push(`WS send: ${typeof d === "string" ? d.slice(0, 100) : "bin(" + (d && d.length) + ")"}`); }
    close() {}
  };
}

const UNI = new Proxy(function () {}, {
  get(t, p) {
    if (p === Symbol.toPrimitive) return () => "";
    if (p === "toString" || p === "valueOf") return () => "";
    if (p === "then") return undefined; // avoid thenable traps
    return UNI;
  },
  apply() { return UNI; },
  construct() { return UNI; },
  has() { return true; },
});

function run(file, tag) {
  const src = fs.readFileSync(file, "utf8");
  const log = [];
  const payloads = []; // {kind, body}
  const baseKeys = new Set();

  const sandbox = {
    console: { log: (...a) => log.push("console.log: " + a.map(String).join(" ").slice(0, 400)), warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    JSON, Math, Promise, Date, Array, Object, String, Number, Boolean, BigInt, RegExp, Error, TypeError, RangeError,
    Symbol, Map, Set, WeakMap, WeakSet, Reflect, Proxy, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, BigInt64Array, BigUint64Array,
    ArrayBuffer, SharedArrayBuffer: typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : ArrayBuffer,
    DataView, TextEncoder, TextDecoder, URL, URLSearchParams, Blob: class Blob {}, File: class File {},
    FormData: class FormData {}, Headers: class Headers {}, Request: class Request {}, Response: class Response {},
    AbortController: class AbortController { constructor() { this.signal = {}; } abort() {} },
    structuredClone, crypto: require("crypto").webcrypto,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => { setTimeout(fn, 16); return 1; },
    cancelAnimationFrame: () => {},
    setTimeout: (fn) => { if (typeof fn === "function") { try { fn(); } catch {} } return 0; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    queueMicrotask: (fn) => { try { fn(); } catch {} },
    WebSocket: makeWS(log),
    fetch: (u, o) => { log.push(`fetch: ${String(u)}`); return Promise.resolve({ ok: false, status: 0, headers: { get: () => null }, json: () => Promise.resolve({}), text: () => Promise.resolve(""), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }); },
    XMLHttpRequest: class { open(m, u) { log.push(`XHR ${m}: ${u}`); } send() {} setRequestHeader() {} },
    navigator: UNI, location: UNI, localStorage: UNI, sessionStorage: UNI,
    document: UNI, window: undefined, // set below after eval instrumentation
    alert: () => {}, confirm: () => false, prompt: () => null,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  };

  // instrumented eval: capture payload, then run it in-context so chains continue
  sandbox.eval = function (code) {
    const s = String(code);
    payloads.push({ kind: "eval", body: s });
    log.push(`eval captured: ${s.length} bytes, head=${s.slice(0, 120).replace(/\n/g, "\\n")}`);
    try { return vm.runInContext(s, ctx, { filename: `${tag}-eval-${payloads.length}.js`, timeout: 20000 }); }
    catch (e) { log.push(`eval run error: ${e.message.slice(0, 200)}`); }
  };
  sandbox.Function = function (...args) {
    const body = String(args[args.length - 1] || "");
    payloads.push({ kind: "Function", body });
    log.push(`Function captured: ${body.length} bytes, head=${body.slice(0, 120).replace(/\n/g, "\\n")}`);
    return function () {};
  };

  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;
  sandbox.frames = sandbox;

  for (const k of Object.keys(sandbox)) baseKeys.add(k);

  const ctx = vm.createContext(sandbox);
  try {
    vm.runInContext(src, ctx, { filename: tag, timeout: 30000 });
  } catch (e) {
    log.push(`TOP-LEVEL ERROR: ${e.message.slice(0, 300)}`);
  }

  // dump payloads
  payloads.forEach((p, i) => {
    const f = path.join(OUT, `${tag}-payload-${i + 1}-${p.kind}.js`);
    fs.writeFileSync(f, p.body);
  });

  // dump newly defined globals
  const newGlobals = Object.keys(sandbox).filter((k) => !baseKeys.has(k));

  console.log(`\n########## ${tag} (${src.length} bytes) ##########`);
  console.log(`payloads captured: ${payloads.length}`);
  payloads.forEach((p, i) => console.log(`  [#${i + 1}] ${p.kind} ${p.body.length} bytes -> ${tag}-payload-${i + 1}-${p.kind}.js | head: ${p.body.slice(0, 90).replace(/\n/g, "\\n")}`));
  console.log(`new globals defined: ${newGlobals.join(", ") || "(none)"}`);
  console.log("--- dials/events (first 40) ---");
  log.slice(0, 40).forEach((l) => console.log("  " + l));
  return { sandbox, payloads, log };
}

run("/home/z/my-project/upload/loader.js", "loader-v2");
run("/home/z/my-project/upload/main.js", "main-v2");
console.log("\nDONE. payloads in " + OUT);
