#!/usr/bin/env node
/** Deobfuscate the LIVE loader.js (fetched from jsdelivr) and dump payloads. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FILE = "/tmp/live-loader.js";
const OUT = "/home/z/my-project/scripts";

function makeUniversal() {
  const UNI = new Proxy(function () {}, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => "";
      if (p === "toString" || p === "valueOf") return () => "";
      if (p === Symbol.toStringTag) return "Universal";
      if (p === "length") return 0;
      return UNI;
    },
    apply() { return UNI; },
    construct() { return UNI; },
    has() { return true; },
  });
  return UNI;
}

const src = fs.readFileSync(FILE, "utf8");
const captured = [];

function spy(...args) {
  const code = typeof args[0] === "string" ? args[0] : String(args[0]);
  captured.push(code);
  const inert = function () {};
  inert.toString = () => code;
  return inert;
}
const SpyProto = function () {};
Object.setPrototypeOf(spy, SpyProto);
spy.prototype.constructor = spy;

const UNI = makeUniversal();
const sandbox = {
  console, JSON, Math, Promise, Date, Array, Object, String, Number, Boolean,
  RegExp, Error, TypeError, Symbol, Map, Set, WeakMap, WeakSet, Reflect, Proxy,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  Uint8Array, Uint16Array, Uint32Array, Int8Array, Int32Array, Float32Array, Float64Array,
  ArrayBuffer, TextEncoder, TextDecoder, URL, URLSearchParams, Blob: UNI, FormData: UNI,
  window: UNI, document: UNI, navigator: UNI, location: UNI, history: UNI,
  localStorage: UNI, sessionStorage: UNI, indexedDB: UNI, caches: UNI,
  fetch: UNI, XMLHttpRequest: UNI, WebSocket: UNI, RTCPeerConnection: UNI,
  performance: UNI, screen: UNI, crypto: UNI, Notification: UNI, Audio: UNI,
  Image: UNI, requestAnimationFrame: UNI, requestIdleCallback: UNI,
  addEventListener: UNI, removeEventListener: UNI, dispatchEvent: UNI,
  importScripts: UNI, clients: UNI, registration: UNI, skipWaiting: UNI,
  getAsset: UNI, $jetController: UNI, loadScript: UNI,
  AbortSignal: { timeout: () => UNI, any: () => UNI },
  setTimeout: (fn) => { try { fn(); } catch {} return 0; },
  clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  queueMicrotask: () => {}, structuredClone: UNI,
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  Function: spy,
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.globalThis.Function = spy;

const ctx = vm.createContext(sandbox);
try {
  const result = vm.runInContext(src, ctx, { filename: "live-loader.js", timeout: 20000 });
  if (typeof result === "function" && result.toString().length > 200) {
    fs.writeFileSync(path.join(OUT, "live-decoded-ret.txt"), result.toString());
    console.log(`ret fn -> live-decoded-ret.txt (${result.toString().length} chars)`);
  }
} catch (e) {
  console.log(`eval error (continuing): ${e.message.slice(0, 200)}`);
}

captured.filter((c) => c && c.length > 50).forEach((c, i) => {
  const f = path.join(OUT, `live-decoded-fn${i}.txt`);
  fs.writeFileSync(f, c);
  console.log(`payload ${i} -> live-decoded-fn${i}.txt (${c.length} chars)`);
});

console.log("\n══════════ LIVE MIRROR / ENDPOINT SCAN ══════════");
const dumpFiles = fs.readdirSync(OUT).filter((f) => f.startsWith("live-decoded-"));
for (const f of dumpFiles) {
  const txt = fs.readFileSync(path.join(OUT, f), "utf8");
  const hosts = [...new Set(txt.match(/(?:cdn\.)?[a-z0-9-]+\.(?:org|com|net|cfd|io|gg|me)[a-z0-9.\/-]*/gi) || [])];
  const wss = [...new Set(txt.match(/wss?:\/\/[^\s"'`\\)\]},]+/gi) || [])];
  const stratus = [...new Set(txt.match(/stratus[^\s"'`]*/gi) || [])];
  const wlsp = [...new Set(txt.match(/wlsp[^\s"'`]*/gi) || [])];
  if (hosts.length || wss.length || stratus.length || wlsp.length) {
    console.log(`\n--- ${f} ---`);
    if (hosts.length) console.log("HOSTS:\n  " + hosts.slice(0, 60).join("\n  "));
    if (wss.length) console.log("WSS:\n  " + wss.slice(0, 20).join("\n  "));
    if (stratus.length) console.log("STRATUS:", stratus.slice(0, 20).join(", "));
    if (wlsp.length) console.log("WLSP:", wlsp.slice(0, 20).join(", "));
  }
}
