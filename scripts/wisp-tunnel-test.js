#!/usr/bin/env node
/** Wisp v2 tunnel test v2 — CORRECT handshake:
 *  ws open -> CONNECT(type=1, stream=1, [tcp=1][port LE16][host])
 *          <- CONTINUE(stream) = accepted
 *  then TLS inside the tunnel + GET /stratus/status. */
const tls = require("tls");
const stream = require("stream");

const TYPES = { CONNECT: 1, DATA: 2, CONTINUE: 3, CLOSE: 4 };

function createPacket(type, streamId, payload) {
  const out = new Uint8Array(5 + payload.length);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, type, true);
  dv.setUint32(1, streamId, true);
  out.set(payload, 5);
  return out;
}

function wispTunnel(wssUrl, targetHost, targetPort, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let ws;
    const fail = (m) => { try { ws && ws.close(); } catch {} reject(new Error(m)); };
    const timer = setTimeout(() => fail(`tunnel timeout after ${timeoutMs}ms`), timeoutMs);
    try { ws = new WebSocket(wssUrl); } catch (e) { return fail(`ws ctor: ${e.message}`); }
    ws.binaryType = "arraybuffer";

    const streamId = 1;
    let opened = false;
    const pending = [];

    const duplex = new stream.Duplex({
      read() {
        while (pending.length) {
          if (!this.push(pending.shift())) break;
        }
      },
      write(chunk, enc, cb) {
        if (ws.readyState !== 1) return cb(new Error("ws not open"));
        ws.send(createPacket(TYPES.DATA, streamId, new Uint8Array(chunk)));
        cb();
      },
    });

    ws.onopen = () => {
      // CONNECT immediately: [stream_type=1 tcp][port LE16][host]
      const hostBytes = new TextEncoder().encode(targetHost);
      const payload = new Uint8Array(3 + hostBytes.length);
      const dv = new DataView(payload.buffer);
      dv.setUint8(0, 1, true);
      dv.setUint16(1, targetPort, true);
      payload.set(hostBytes, 3);
      ws.send(createPacket(TYPES.CONNECT, streamId, payload));
    };
    ws.onerror = () => { clearTimeout(timer); fail("ws error"); };
    ws.onclose = () => { clearTimeout(timer); if (!opened) fail("ws closed before open"); duplex.destroy(); };
    ws.onmessage = (ev) => {
      const pkt = new Uint8Array(ev.data);
      if (pkt.length < 5) return;
      const dv = new DataView(pkt.buffer, pkt.byteOffset, pkt.byteLength);
      const type = dv.getUint8(0, true);
      const sid = dv.getUint32(1, true);
      const payload = pkt.slice(5);
      if (sid !== streamId) return;
      if (type === TYPES.CONTINUE && !opened) {
        opened = true;
        duplex.emit("tunnel-open");
        return;
      }
      if (type === TYPES.DATA) {
        pending.push(Buffer.from(payload));
        duplex.read(0);
        return;
      }
      if (type === TYPES.CLOSE) {
        clearTimeout(timer);
        duplex.destroy();
        if (!opened) fail(`wisp CLOSE (reason=${payload[0]})`);
      }
    };

    duplex.once("tunnel-open", () => {
      clearTimeout(timer);
      resolve({ duplex, ws });
    });
  });
}

async function tryFetch(label, viaWss, targetHost, path, extraHeaders = []) {
  const t0 = Date.now();
  try {
    const { duplex, ws } = await wispTunnel(viaWss, targetHost, 443, 12000);
    const tTun = Date.now() - t0;
    const sock = tls.connect({ socket: duplex, servername: targetHost, rejectUnauthorized: false });
    const req = [
      `GET ${path} HTTP/1.1`,
      `Host: ${targetHost}`,
      "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept: application/json, text/plain, */*",
      ...extraHeaders,
      "Connection: close",
      "\r\n",
    ].join("\r\n");
    let buf = Buffer.alloc(0);
    const result = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("http timeout")), 12000);
      sock.on("data", (d) => {
        buf = Buffer.concat([buf, d]);
        if (buf.toString("latin1").includes("\r\n\r\n") || buf.length > 8192) {
          clearTimeout(to);
          resolve(buf.toString("latin1"));
        }
      });
      sock.on("error", (e) => { clearTimeout(to); reject(e); });
      sock.on("close", () => { clearTimeout(to); resolve(buf.toString("latin1")); });
      sock.write(req);
    });
    try { ws.close(); } catch {}
    const statusLine = result.split("\r\n")[0];
    const body = result.split("\r\n\r\n").slice(1).join("\r\n\r\n").slice(0, 200).replace(/\s+/g, " ");
    console.log(`[${label}] tunnel=${tTun}ms total=${Date.now() - t0}ms — ${statusLine} | body: ${body || "(empty)"}`);
  } catch (e) {
    console.log(`[${label}] FAILED after ${Date.now() - t0}ms — ${e.message}`);
  }
}

(async () => {
  console.log("=== wisp v2 tunnel tests (fixed handshake) ===");
  await tryFetch("via pcesc -> vipersfutbol /stratus/status", "wss://cdn.pcesc.org/", "cdn.vipersfutbol.com", "/stratus/status");
  await tryFetch("via vipers -> vipersfutbol (self)", "wss://cdn.vipersfutbol.com/", "cdn.vipersfutbol.com", "/stratus/status");
  await tryFetch("via vipers -> pcesc /stratus/games", "wss://cdn.vipersfutbol.com/", "cdn.pcesc.org", "/stratus/games");
  await tryFetch("via pcesc -> example.com (sanity)", "wss://cdn.pcesc.org/", "example.com", "/");
  process.exit(0);
})();
