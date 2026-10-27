// Wisp (WLSP) server liveness prober — replicates the working portal's
// testWlspDomain() handshake byte-for-byte (decoded loader-v2 payload).
// Frame wire order: [packet_type:u8][stream_id:u32 LE][payload]
// Server may open with control frames on stream 0:
//   type 5 -> reply [5, id=0, 0x02,0x01]
//   type 3 -> send NEW_STREAM [1, id, 0x45, 0x00, hostLen, host]
// Success = DATA echo on our stream id (measures RTT).

const SERVERS = [
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

const toUrl = (s) => (s.includes("://") ? s : `wss://${s}/`);

function probe(server, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new WebSocket(toUrl(server));
    } catch (e) {
      return resolve({ server, ok: false, reason: "ctor:" + e.message });
    }
    ws.binaryType = "arraybuffer";
    const id = (Math.floor(4294967294 * Math.random()) + 1) >>> 0;
    let echoed = false;
    let t0 = 0;
    const finish = (ok, extra) => {
      clearTimeout(timer);
      try { ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); } catch {}
      resolve({ server, url: toUrl(server), ok, ...(extra || {}) });
    };
    const timer = setTimeout(() => finish(false, { reason: echoed ? "no-echo" : "timeout" }), timeoutMs);
    ws.onerror = () => finish(false, { reason: "ws-error" });
    ws.onclose = (ev) => finish(false, { reason: `closed(code=${ev.code ?? "?"})` });
    ws.onmessage = ({ data }) => {
      if (!(data instanceof ArrayBuffer) || data.byteLength < 5) return finish(false, { reason: "bad-frame" });
      const dv = new DataView(data);
      const type = dv.getUint8(0);
      const sid = dv.getUint32(1, true);
      if (echoed) {
        if (sid === id) {
          const rtt = Math.round(performance.now() - t0);
          finish(true, { rtt, note: "echo-ok" });
        }
        return;
      }
      if (sid === 0) {
        if (type === 5) {
          ws.send(new Uint8Array([5, 0, 0, 0, 0, 2, 1]));
        } else if (type === 3) {
          const host = "127.0.0.1";
          const hb = new TextEncoder().encode(host);
          const frame = new Uint8Array([1, 0, 0, 0, 0, 1, 69, 0, hb.length, ...hb]);
          new DataView(frame.buffer).setUint32(1, id, true);
          echoed = true; // next inbound frame on our id = alive
          t0 = performance.now();
          ws.send(frame);
        }
      }
    };
  });
}

const mode = process.argv[2] || "server-first";
const results = [];
for (const s of SERVERS) {
  const r = await probe(s);
  results.push(r);
  console.log(
    `${r.ok ? "ALIVE " : "dead  "} ${s.padEnd(34)} ${r.ok ? `rtt=${r.rtt}ms` : r.reason}`
  );
}
const alive = results.filter((r) => r.ok);
console.log(`\n=== ${alive.length}/${results.length} wisp servers alive ===`);
if (alive.length) console.log("WINNER:", alive.sort((a, b) => a.rtt - b.rtt)[0].url);
