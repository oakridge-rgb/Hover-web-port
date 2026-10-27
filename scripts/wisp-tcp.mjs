// Raw TCP over wisp — reverse-engineered frame layout from testWlspDomain:
//   server->client: [type u8][stream_id u32 LE][payload]
//   client->server NEW_STREAM (observed): [0x01][id:4LE][portA,portB][hostLen u8][host]
//     probe used [0x45,0x00] + "127.0.0.1"  => port little-endian (69) or 0x45=type byte?
//   We try BOTH interpretations until one yields an HTTP response.
//   client->server DATA = [0x02][id:4LE][payload]   CLOSE = [0x03][id:4LE][reason?]
//   CONTINUE (window) = [0x00][id:4LE][amount u32 LE]

const args = process.argv.slice(2);
const lane = args[0] || "wss://api.personalloanonline.net/ws/";
const host = args[1] || "92.38.177.45";
const port = parseInt(args[2] || "80", 10);
const rawReq = args[3] || `GET /stratus/status HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`;
const mode = args[4] || "auto"; // auto | le | be

const ws = new WebSocket(lane);
ws.binaryType = "arraybuffer";

let id = (Math.floor(4294967294 * Math.random()) + 1) >>> 0;
let buf = [];
let done = false;
const t0 = Date.now();

const finish = (msg) => {
  if (done) return;
  done = true;
  console.log(`\n===== RESULT (${Date.now() - t0}ms) ${msg} =====`);
  try { ws.close(); } catch {}
  process.exit(0);
};

setTimeout(() => finish("timeout"), 20000);

ws.onmessage = ({ data }) => {
  if (!(data instanceof ArrayBuffer)) return;
  const dv = new DataView(data);
  const type = dv.getUint8(0);
  const sid = dv.getUint32(1, true);
  const payload = new Uint8Array(data, 5);
  if (sid === 0 && !opened()) {
    if (type === 5) ws.send(new Uint8Array([5, 0, 0, 0, 0, 2, 1]));
    else if (type === 3) {
      // handshake step 2: send our NEW_STREAM (try layout variants)
      const hb = new TextEncoder().encode(host);
      const variants = [];
      if (mode !== "be") variants.push("le");
      if (mode !== "le") variants.push("be");
      for (const v of variants) {
        // [0x01][id u32 LE][type=0x01 TCP][port u16][host...]  (host = rest of frame, no len byte)
        const frame = v === "le"
          ? new Uint8Array([1, 0, 0, 0, 0, 1, port & 0xff, (port >> 8) & 0xff, ...hb])
          : new Uint8Array([1, 0, 0, 0, 0, 1, (port >> 8) & 0xff, port & 0xff, ...hb]);
        new DataView(frame.buffer).setUint32(1, id, true);
        ws.send(frame);
        console.log(`[sent NEW_STREAM ${v} port=${port} host=${host}]`);
      }
    }
    return;
  }
  if (sid === id) {
    console.log(`[frame type=${type} len=${payload.length}]`);
    buf.push(payload);
    // heuristics: HTTP response ends
    const all = concat(buf);
    const s = new TextDecoder().decode(all);
    if (type === 1 || /<\/html>|0\r\n\r\n$|\r\n\r\n/.test(s) && s.includes("HTTP/1.")) {
      console.log("----- RAW -----");
      console.log(s.slice(0, 3000));
      finish("got-response");
    }
  }
};

const opened = () => false;

ws.onerror = () => finish("ws-error");
ws.onclose = (e) => finish(`closed code=${e.code}`);

function concat(list) {
  const len = list.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const b of list) { out.set(b, o); o += b.length; }
  return out;
}
