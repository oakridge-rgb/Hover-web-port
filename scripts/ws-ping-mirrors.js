#!/usr/bin/env node
/** Replicate the portal's testWlspDomain WS ping from Node (sandbox view). */
const MIRRORS = [
  "cdn.northstreetumc.org",
  "cdn.vipersfutbol.com",
  "cdn.pcesc.org",
  "cdn.kcchallengevbc.com",
  "cdn.slcbmooc.org",
  "cdn.topstargym.net",
  "cdn.goaplytexas.org",
  "cdn.clearfieldswimming.com",
  "cdn.richardacademy.cfd",
  "wss://athollcottage.com/connection/",
  "wss://api.personalloanonline.net/ws/",
];

function ping(entry, timeout = 3000) {
  return new Promise((resolve) => {
    const url = entry.includes("://") ? entry : `wss://${entry}/`;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      return resolve(null);
    }
    ws.binaryType = "arraybuffer";
    const nonce = (Math.floor(4294967294 * Math.random()) + 1) >>> 0;
    let armed = false, t0 = 0;
    const done = (v) => {
      clearTimeout(timer);
      ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch {}
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeout);
    ws.onerror = () => done(null);
    ws.onclose = () => done(null);
    ws.onmessage = ({ data }) => {
      if (!(data instanceof ArrayBuffer) || data.byteLength < 5) return done(null);
      const dv = new DataView(data);
      const b0 = dv.getUint8(0);
      const n = dv.getUint32(1, true);
      if (armed) return n === nonce ? done(Math.round(performance.now() - t0)) : done(null);
      if (n === 0) {
        if (b0 === 5) ws.send(new Uint8Array([5, 0, 0, 0, 0, 2, 1]));
        else if (b0 === 3) {
          const pkt = new Uint8Array([1, 0, 0, 0, 0, 1, 69, 0, ...new TextEncoder().encode("127.0.0.1")]);
          new DataView(pkt.buffer).setUint32(1, nonce, true);
          armed = true;
          t0 = performance.now();
          ws.send(pkt);
        }
      }
    };
  });
}

(async () => {
  console.log("=== portal-style WS ping (3s timeout, sequential like getWlsp) ===");
  for (const m of MIRRORS) {
    const ms = await ping(m);
    console.log(`[${m}] ${ms === null ? "DEAD/TIMEOUT" : `ALIVE ${ms}ms`}`);
  }
  process.exit(0);
})();
