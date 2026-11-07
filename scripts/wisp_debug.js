#!/usr/bin/env node
'use strict';
/* debug: try candidate wisp CONNECT layouts, hex-log every server frame */
const EP = process.argv[2] || 'wss://wisp.mercurywork.shop/wisp/';
const HOST = 'example.com';
const hex = (b) => Buffer.from(b).toString('hex').slice(0, 80);

function layoutA(host, port, id) { // engine: [C1][id u32le][type][port le][host]
  const hb = Buffer.from(host); const f = Buffer.alloc(8 + hb.length);
  f[0] = 0x01; f.writeUInt32LE(id, 1); f[5] = 0x01; f.writeUInt16LE(port, 6); hb.copy(f, 8); return f;
}
function layoutB(host, port, id) { // spec: [C1][id u32le][ver][type][port BE][hlen][host]
  const hb = Buffer.from(host); const f = Buffer.alloc(10 + hb.length);
  f[0] = 0x01; f.writeUInt32LE(id, 1); f[5] = 0x01; f[6] = 0x01; f.writeUInt16BE(port, 7); f[9] = hb.length; hb.copy(f, 10); return f;
}
function layoutC(host, port, id) { // spec LE port
  const hb = Buffer.from(host); const f = Buffer.alloc(10 + hb.length);
  f[0] = 0x01; f.writeUInt32LE(id, 1); f[5] = 0x01; f[6] = 0x01; f.writeUInt16LE(port, 7); f[9] = hb.length; hb.copy(f, 10); return f;
}
function layoutD(host, port, id) { // old v1: [ver=1][type=1][id u16le] + http GET (proxy style)
  const f = Buffer.alloc(4); f[0] = 0x01; f[1] = 0x01; f.writeUInt16LE(id, 2); return f;
}
function layoutE(host, port, id) { // old v1 CONNECT-style
  const f = Buffer.alloc(4); f[0] = 0x01; f[1] = 0x01; f.writeUInt16LE(id, 2); return f;
}
const PAYLOAD_GET = `GET / HTTP/1.1\r\nHost: ${HOST}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`;
const PAYLOAD_CONNECT = `CONNECT ${HOST}:80 HTTP/1.1\r\nHost: ${HOST}:80\r\n\r\n`;

function trial(label, buildFirst, secondPayload, ms) {
  return new Promise((resolve) => {
    const ws = new WebSocket(EP);
    ws.binaryType = 'arraybuffer';
    const log = [];
    const fin = (why) => {
      try { ws.close(); } catch (e) {}
      resolve({ label, why, log });
    };
    const t = setTimeout(() => fin('timeout'), ms);
    ws.onopen = () => {
      try {
        ws.send(buildFirst());
        if (secondPayload) setTimeout(() => { try { ws.send(Buffer.from(secondPayload)); } catch (e) {} }, 60);
      } catch (e) { fin('send-err:' + e.message); }
    };
    ws.onerror = (e) => fin('error');
    ws.onclose = (e) => { clearTimeout(t); fin('close code=' + e.code + ' reason=' + (e.reason || '').slice(0, 40)); };
    ws.onmessage = (ev) => {
      const b = Buffer.from(ev.data);
      log.push(hex(b));
      clearTimeout(t);
      setTimeout(() => fin('got-frame'), 1200);
    };
  });
}

(async () => {
  const trials = [
    ['A engine  portLE', () => layoutA(HOST, 80, 1), null],
    ['B spec    portBE+hlen', () => layoutB(HOST, 80, 1), null],
    ['C spec    portLE+hlen', () => layoutC(HOST, 80, 1), null],
    ['D oldv1   ver+type+id16 +GET', () => layoutD(HOST, 80, 1), PAYLOAD_GET],
    ['E oldv1   +CONNECT', () => layoutE(HOST, 80, 1), PAYLOAD_CONNECT],
  ];
  for (const [l, b, p] of trials) {
    const r = await trial(l, b, p, 8000);
    console.log(r.label.padEnd(28), r.why.padEnd(38), r.log.join(' | ') || '(no frames)');
  }
})();
