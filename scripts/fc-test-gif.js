const FCGIF = require('./fc-gif.js');
const fs = require('fs');

const W = 160, H = 120, N = 4;

function makeFrame(t) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      d[o] = Math.round(255 * x / W);
      d[o + 1] = Math.round(255 * y / H);
      d[o + 2] = 128;
      d[o + 3] = 255;
      const cx = (0.3 + 0.4 * t) * W, cy = H / 2, r = H * 0.18;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = 255; }
    }
  }
  return d;
}

const frames = [];
for (let t = 0; t < N; t++) {
  const data = makeFrame(t / (N - 1));
  const pal = FCGIF.medianCutPalette(data, W, H, 256);
  const idx = FCGIF.indexMap(data, W, H, pal);
  frames.push({ palette: pal, pixels: idx });
}
const bytes = FCGIF.buildGIF(frames, W, H, 10, 0);
fs.writeFileSync('/tmp/fc_test.gif', Buffer.from(bytes));
console.log('gif bytes:', bytes.length);

// sanity: header + trailer
const b = bytes;
console.log('header:', Buffer.from(b.slice(0, 6)).toString(), 'trailer:', b[b.length - 1]);
if (Buffer.from(b.slice(0, 6)).toString() !== 'GIF89a') throw new Error('bad header');
if (b[b.length - 1] !== 0x3b) throw new Error('bad trailer');
console.log('OK');
