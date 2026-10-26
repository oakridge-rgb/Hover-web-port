#!/usr/bin/env node
/** Raw protocol experiment against a mirror WS endpoint.
 *  Strategies: (a) dump greeting, (b) ack-5 then wisp CONNECT,
 *  (c) greeting -> direct wisp CONNECT, (d) portal nonce-probe then wisp CONNECT. */
const WSS = process.argv[2] || "wss://cdn.vipersfutbol.com/";
const TARGET = process.argv[3] || "cdn.vipersfutbol.com";

const hex = (u8) => [...u8.slice(0, 48)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
const txt = (u8) => { try { return new TextDecoder().decode(u8).slice(0, 80); } catch { return ""; } };

function frame(type, streamId, payload) {
  const out = new Uint8Array(5 + payload.length);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, type, true);
  dv.setUint32(1, streamId, true);
  out.set(payload, 5);
  return out;
}

function connectPayload(host, port) {
  const hb = new TextEncoder().encode(host);
  const p = new Uint8Array(3 + hb.length);
  const dv = new DataView(p.buffer);
  dv.setUint8(0, 1, true);
  dv.setUint16(1, port, true);
  p.set(hb, 3);
  return p;
}

function session(label, strategy, waitMs = 6000) {
  return new Promise((resolve) => {
    const log = [];
    let ws;
    try { ws = new WebSocket(WSS); } catch (e) { console.log(`[${label}] ctor fail ${e.message}`); return resolve(log); }
    ws.binaryType = "arraybuffer";
    const t0 = Date.now();
    const done = () => { try { ws.close(); } catch {} resolve(log); };
    const to = setTimeout(done, waitMs);
    let sawGreeting = false;

    ws.onmessage = (ev) => {
      const p = new Uint8Array(ev.data);
      const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
      const type = dv.getUint8(0, true);
      const sid = dv.getUint32(1, true);
      log.push(`rx  @${Date.now() - t0}ms type=${type} sid=${sid} len=${p.length} hex[${hex(p)}] txt="${txt(p.slice(5))}"`);
      if ((type === 3 || type === 5) && sid === 0 && !sawGreeting) {
        sawGreeting = true;
        if (strategy === "ack5") {
          const ack = new Uint8Array([5, 0, 0, 0, 0, 2, 1]);
          ws.send(ack);
          log.push(`tx  ack5 [5,0,0,0,0,2,1]`);
        } else if (strategy === "probe3") {
          const nonce = 0x11223344;
          const hostB = new TextEncoder().encode("127.0.0.1");
          const pkt = new Uint8Array([1, 0, 0, 0, 0, 1, 69, 0, ...hostB]);
          new DataView(pkt.buffer).setUint32(1, nonce, true);
          ws.send(pkt);
          log.push(`tx  probe3 nonce=${nonce.toString(16)}`);
        } else if (strategy === "greet-then-connect") {
          ws.send(frame(1, 1, connectPayload(TARGET, 443)));
          log.push(`tx  wisp CONNECT after greeting`);
        }
        return;
      }
      if (type === 3 && sid === 1) log.push(`    -> stream1 CONTINUE (accepted) size=${dv.getUint32(5, true)}`);
      if (type === 2 && sid === 1) log.push(`    -> stream1 DATA`);
      if (type === 4) log.push(`    -> CLOSE reason=${p[5]}`);
    };
    ws.onerror = () => { log.push(`ws error`); clearTimeout(to); done(); };
    ws.onclose = (ev) => { log.push(`ws close code=${ev.code || "?"}`); clearTimeout(to); done(); };

    ws.onopen = () => {
      log.push(`ws open @${Date.now() - t0}ms`);
      if (strategy === "direct-connect") {
        ws.send(frame(1, 1, connectPayload(TARGET, 443)));
        log.push(`tx  wisp CONNECT immediately (no greeting wait)`);
      }
    };
  });
}

(async () => {
  for (const s of ["dump-only", "direct-connect", "ack5", "greet-then-connect", "probe3"]) {
    console.log(`\n===== strategy: ${s} =====`);
    const log = await session(s, s, 6000);
    log.forEach((l) => console.log("  " + l));
  }
  process.exit(0);
})();
