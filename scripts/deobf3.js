#!/usr/bin/env node
/** Deobfuscator v3 — self-healing sandbox: stubs missing globals on demand,
 *  captures eval + Function payloads, recurses one level into eval'd code. */
const fs = require("fs");
const vm = require("vm");

const FILE = process.argv[2] || "/tmp/live-loader.js";
const OUT = "/home/z/my-project/scripts";

function makeUniversal() {
  const UNI = new Proxy(function () {}, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => "";
      if (p === "toString" || p === "valueOf") return () => "";
      if (p === Symbol.toStringTag) return "Universal";
      if (p === "length") return 0;
      if (p === "then") return undefined; // keep await from hanging on UNI
      return UNI;
    },
    apply() { return UNI; },
    construct() { return UNI; },
    has() { return true; },
  });
  return UNI;
}

const captured = []; // { kind, code }
const UNI = makeUniversal();

function buildSandbox() {
  function spy(...args) {
    const code = typeof args[0] === "string" ? args[0] : String(args[0]);
    captured.push({ kind: "Function", code });
    const inert = function () {};
    inert.toString = () => code;
    return inert;
  }
  const evalSpy = (code) => {
    const c = typeof code === "string" ? code : String(code);
    captured.push({ kind: "eval", code: c });
    // run it in a nested context with the same stubs so its Function calls get captured too
    try {
      const sb = buildSandbox();
      sb.Function = spy;
      const ctx2 = vm.createContext(sb);
      vm.runInContext(c, ctx2, { timeout: 15000 });
    } catch { /* capture-only */ }
    return UNI;
  };
  const sb = {
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
    JSON, Math, Promise, Date, Array, Object, String, Number, Boolean,
    RegExp, Error, TypeError, Symbol, Map, Set, WeakMap, WeakSet, Reflect, Proxy,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int32Array, Float32Array, Float64Array,
    BigInt, ArrayBuffer, SharedArrayBuffer: UNI, DataView, TextEncoder, TextDecoder, URL, URLSearchParams,
    Blob: UNI, FormData: UNI, AbortController,
    window: UNI, document: UNI, navigator: UNI, location: UNI, history: UNI,
    localStorage: UNI, sessionStorage: UNI, indexedDB: UNI, caches: UNI,
    fetch: UNI, XMLHttpRequest: UNI, WebSocket: UNI, RTCPeerConnection: UNI,
    performance: UNI, screen: UNI, crypto: UNI, Notification: UNI, Audio: UNI,
    Image: UNI, OffscreenCanvas: UNI, FontFace: UNI, ImageData: UNI,
    requestAnimationFrame: UNI, requestIdleCallback: UNI, cancelAnimationFrame: () => {},
    addEventListener: UNI, removeEventListener: UNI, dispatchEvent: UNI,
    importScripts: UNI, clients: UNI, registration: UNI, skipWaiting: UNI,
    getAsset: UNI, $jetController: UNI, loadScript: UNI,
    AbortSignal: { timeout: () => UNI, any: () => UNI },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    queueMicrotask: () => {}, structuredClone: UNI,
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    Function: spy,
  };
  sb.globalThis = sb;
  sb.self = sb;
  sb.global = sb;
  sb.eval = evalSpy;
  return sb;
}

const src = fs.readFileSync(FILE, "utf8");
let sandbox = buildSandbox();
sandbox.Function = (...args) => {
  const code = typeof args[0] === "string" ? args[0] : String(args[0]);
  captured.push({ kind: "Function", code });
  const inert = function () {};
  inert.toString = () => code;
  return inert;
};
let ctx = vm.createContext(sandbox);

// self-healing loop: run, stub whatever global is missing, retry
for (let attempt = 1; attempt <= 12; attempt++) {
  try {
    vm.runInContext(src, ctx, { filename: "loader", timeout: 25000 });
    console.log(`[run ${attempt}] completed`);
    break;
  } catch (e) {
    const msg = e.message || "";
    const m = msg.match(/(\w+) is not defined/);
    if (m && !sandbox[m[1]]) {
      console.log(`[run ${attempt}] stubbing missing global: ${m[1]}`);
      sandbox[m[1]] = makeUniversal();
      ctx = vm.createContext(sandbox);
    } else {
      console.log(`[run ${attempt}] stopped: ${msg.slice(0, 180)}`);
      break;
    }
  }
}

// dedupe + dump
const seen = new Set();
let i = 0;
for (const { kind, code } of captured) {
  if (!code || code.length < 40 || seen.has(code)) continue;
  seen.add(code);
  const f = `${OUT}/live3-${kind}-${i++}.txt`;
  fs.writeFileSync(f, code);
  console.log(`${kind} payload (${code.length} chars) -> ${f}`);
}
if (!seen.size) console.log("NO PAYLOADS CAPTURED");

console.log("\n══════════ ENDPOINT SCAN ══════════");
const files = fs.readdirSync(OUT).filter((f) => f.startsWith("live3-"));
const hosts = new Set(), wss = new Set(), paths = new Set();
for (const f of files) {
  const txt = fs.readFileSync(`${OUT}/${f}`, "utf8");
  for (const h of txt.match(/(?:cdn\.)?[a-z0-9-]{2,}\.(?:org|com|net|cfd|io|gg|me|us|xyz|top)(?:\/[^\s"'`\\)\]},]*)?/gi) || []) hosts.add(h);
  for (const w of txt.match(/wss?:\/\/[^\s"'`\\)\]},]+/gi) || []) wss.add(w);
  for (const p of txt.match(/\/stratus[^\s"'`]*/gi) || []) paths.add(p);
}
console.log("HOSTS:\n  " + [...hosts].slice(0, 80).join("\n  "));
console.log("WSS:\n  " + [...wss].slice(0, 20).join("\n  "));
console.log("STRATUS PATHS:\n  " + [...paths].slice(0, 30).join("\n  "));
