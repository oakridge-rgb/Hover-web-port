#!/usr/bin/env node
/**
 * Static deobfuscator for the opium portal scripts.
 * The obfuscated files are IIFEs whose final expression is
 *   globalThis["Function"](decodedCodeString)
 * Constructing a Function does NOT execute its body, so we can safely
 * evaluate the wrapper in a Node VM and dump the readable payload source.
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const FILES = ["loader.js", "main.js", "sw.js"].map((f) =>
  path.join("/home/z/my-project/upload", f)
);

const browserStubs = {
  window: undefined,
  document: {
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
    getElementById: () => null,
    querySelector: () => null,
    addEventListener() {},
    head: { appendChild() {} },
    title: "",
  },
  navigator: { userAgent: "node" },
  location: { href: "https://example.com/", origin: "https://example.com", protocol: "https:" },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  fetch: () => Promise.reject(new Error("network disabled")),
  XMLHttpRequest: function () { this.open = () => {}; this.send = () => {}; },
  indexedDB: { open: () => ({}) },
  caches: { keys: async () => [], open: async () => ({}) },
  self: {},
  importScripts() {},
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Promise, Array, Object, String, Math, JSON, RegExp, Error, Date,
};

for (const file of FILES) {
  const name = path.basename(file);
  console.log("\n══════════════════════════════════════════");
  console.log("FILE:", name, `(${fs.statSync(file).size} bytes)`);
  console.log("══════════════════════════════════════════");
  const src = fs.readFileSync(file, "utf8");

  const sandbox = { ...browserStubs, globalThis: {}, self: {} };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);

  try {
    const result = vm.runInContext(src, ctx, { filename: name, timeout: 15000 });
    if (typeof result === "function") {
      const code = result.toString();
      fs.writeFileSync(path.join("/home/z/my-project/scripts", `decoded-${name}.txt`), code);
      console.log(`[+] decoded payload -> scripts/decoded-${name}.txt (${code.length} chars)`);
    } else {
      console.log("[!] return value type:", typeof result, result === undefined ? "(undefined — check listeners)" : "");
    }
  } catch (e) {
    console.log("[!] VM eval failed:", e.message.slice(0, 300));
  }

  // Fallback / supplement: brute-force static scan of decoded strings
  try {
    const probe = vm.runInContext(
      `(function(){ const out=[]; const orig=Function; ` +
      `globalThis.Function=function(...a){ out.push(String(a[0]).slice(0,200)); return function(){}; }; ` +
      `try { ${src} } catch(e){} globalThis.Function=orig; return out; })()`,
      ctx,
      { timeout: 15000 }
    );
    if (Array.isArray(probe) && probe.length) {
      console.log(`[+] Function-constructor captures: ${probe.length}`);
      probe.slice(0, 3).forEach((s, i) => console.log(`  capture[${i}]: ${s.slice(0, 120)}`));
    }
  } catch (e) {
    console.log("[!] probe failed:", e.message.slice(0, 200));
  }
}

// Scan any decoded dumps for URLs
const glob = require("fs").readdirSync("/home/z/my-project/scripts").filter((f) => f.startsWith("decoded-"));
console.log("\n════════ URL SCAN ════════");
for (const f of glob) {
  const txt = fs.readFileSync(path.join("/home/z/my-project/scripts", f), "utf8");
  const urls = [...new Set(txt.match(/https?:\/\/[^\s"'`\\)\]}]+/g) || [])];
  const wss = [...new Set(txt.match(/wss?:\/\/[^\s"'`\\)\]}]+/g) || [])];
  const rtc = [...new Set(txt.match(/RTCPeerConnection|createOffer|datachannel|addTransceiver/g) || [])];
  const domains = [...new Set((txt.match(/([a-z0-9-]+\.(?:com|net|org|io|app|dev|gg|xyz|ws|to|me|cc))(\/[^\s"'`\\)\]}]*)?/gi) || []).map(s => s.slice(0, 100)))];
  console.log(`\n--- ${f} ---`);
  if (urls.length) console.log("http urls:", urls.slice(0, 40).join("\n  "));
  if (wss.length) console.log("ws urls:", wss.slice(0, 20).join("\n  "));
  if (rtc.length) console.log("webrtc hits:", [...new Set(rtc)].join(", "));
  if (domains.length) console.log("domains:", domains.slice(0, 60).join("\n  "));
}
