#!/usr/bin/env node
/** Deobfuscator v2 — universal-proxy sandbox that records every Function() payload. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const DIR = "/home/z/my-project/upload";
const OUT = "/home/z/my-project/scripts";

/** Universal "anything" stub: callable, constructible, any property. */
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

function deobf(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const captured = [];

  // Function spy: records payload, returns inert wrapper whose toString = payload
  function spy(...args) {
    const code = typeof args[0] === "string" ? args[0] : String(args[0]);
    captured.push(code);
    const inert = function () {};
    inert.toString = () => code;
    inert.__payload = code;
    return inert;
  }
  // make `new Function(code)` work the same
  const SpyProto = function () {};
  Object.setPrototypeOf(spy, SpyProto);
  spy.prototype.constructor = spy;

  const UNI = makeUniversal();
  const sandbox = {
    // natives stay real
    console, JSON, Math, Promise, Date, Array, Object, String, Number, Boolean,
    RegExp, Error, TypeError, Symbol, Map, Set, WeakMap, WeakSet, Reflect, Proxy,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int32Array, Float32Array, Float64Array,
    ArrayBuffer, TextEncoder, TextDecoder, URL, URLSearchParams, Blob: UNI, FormData: UNI,
    // browser env stubbed universal
    window: UNI, document: UNI, navigator: UNI, location: UNI, history: UNI,
    localStorage: UNI, sessionStorage: UNI, indexedDB: UNI, caches: UNI,
    fetch: UNI, XMLHttpRequest: UNI, WebSocket: UNI, RTCPeerConnection: UNI,
    performance: UNI, screen: UNI, crypto: UNI, Notification: UNI, Audio: UNI,
    Image: UNI, requestAnimationFrame: UNI, requestIdleCallback: UNI,
    addEventListener: UNI, removeEventListener: UNI, dispatchEvent: UNI,
    importScripts: UNI, clients: UNI, registration: UNI, skipWaiting: UNI,
    getAsset: UNI, $jetController: UNI,
    setTimeout: (fn) => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    queueMicrotask: () => {}, structuredClone: UNI, atob: (s) => Buffer.from(s, "base64").toString("binary"),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    Function: spy,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis.Function = spy;

  const ctx = vm.createContext(sandbox);
  let result;
  try {
    result = vm.runInContext(src, ctx, { filename: file, timeout: 20000 });
  } catch (e) {
    console.log(`[${file}] eval error (continuing with captures): ${e.message.slice(0, 160)}`);
  }

  const dump = (code, suffix) => {
    const f = path.join(OUT, `decoded-${file}${suffix}.txt`);
    fs.writeFileSync(f, code);
    console.log(`[${file}] -> ${path.basename(f)} (${code.length} chars)`);
    return f;
  };

  if (typeof result === "function" && result.toString().length > 200) {
    dump(result.toString(), "-ret");
  }
  captured.filter((c) => c && c.length > 50).forEach((c, i) => dump(c, `-fn${i}`));
  if (!captured.length && !(typeof result === "function")) {
    console.log(`[${file}] no Function payloads captured`);
  }
  return captured;
}

for (const f of ["loader.js", "main.js", "sw.js"]) {
  console.log("\n═══════", f, "═══════");
  try { deobf(f); } catch (e) { console.log("failed:", e.message); }
}

// URL / endpoint scan across dumps
console.log("\n══════════════ URL SCAN ══════════════");
const files = fs.readdirSync(OUT).filter((f) => f.startsWith("decoded-"));
for (const f of files) {
  const txt = fs.readFileSync(path.join(OUT, f), "utf8");
  const urls = [...new Set(txt.match(/https?:\/\/[^\s"'`\\)\]},]+/g) || [])];
  const rtc = [...new Set(txt.match(/RTCPeerConnection|createDataChannel|addTransceiver|ontrack|MediaStream/g) || [])];
  const cloud = [...new Set(txt.match(/cloud[A-Za-z]*/gi) || [])];
  if (!urls.length && !rtc.length) continue;
  console.log(`\n--- ${f} ---`);
  if (urls.length) console.log("URLS:\n  " + urls.slice(0, 50).join("\n  "));
  if (rtc.length) console.log("WEBRTC:", rtc.join(", "));
  if (cloud.length) console.log("CLOUD*:", [...new Set(cloud)].slice(0, 30).join(", "));
}
