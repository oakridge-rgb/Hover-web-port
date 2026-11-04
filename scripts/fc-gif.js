/* fc-gif.js — GIF89a encoder: median-cut quantizer + LZW writer. Pure JS, no DOM. */
const FCGIF = (function () {

  function clampByte(v) { v = v | 0; return v < 0 ? 0 : v > 255 ? 255 : v; }

  function boxRange(b) {
    var mn0 = 255, mn1 = 255, mn2 = 255, mx0 = 0, mx1 = 0, mx2 = 0;
    for (var i = 0; i < b.length; i++) {
      var p = b[i];
      if (p[0] < mn0) mn0 = p[0]; if (p[0] > mx0) mx0 = p[0];
      if (p[1] < mn1) mn1 = p[1]; if (p[1] > mx1) mx1 = p[1];
      if (p[2] < mn2) mn2 = p[2]; if (p[2] > mx2) mx2 = p[2];
    }
    var r0 = mx0 - mn0, r1 = mx1 - mn1, r2 = mx2 - mn2;
    var ch = 0, rr = r0;
    if (r1 > rr) { rr = r1; ch = 1; }
    if (r2 > rr) { rr = r2; ch = 2; }
    return { ch: ch, score: r0 + r1 + r2 };
  }

  function boxAvg(b) {
    var r = 0, g = 0, bl = 0, n = b.length;
    for (var i = 0; i < n; i++) { r += b[i][0]; g += b[i][1]; bl += b[i][2]; }
    return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
  }

  /* data: RGBA bytes of a frame. Returns palette array of 256 [r,g,b]. */
  function medianCutPalette(data, W, H, maxColors) {
    maxColors = maxColors || 256;
    var px = [];
    var total = W * H;
    var stride = Math.max(1, Math.floor(total / 24000));
    for (var i = 0; i < total; i += stride) {
      var o = i << 2;
      if (data[o + 3] < 128) continue;
      px.push([data[o], data[o + 1], data[o + 2]]);
    }
    if (!px.length) px.push([255, 255, 255]);
    var boxes = [px];
    while (boxes.length < maxColors) {
      var bi = -1, bs = -1, bch = 0;
      for (var k = 0; k < boxes.length; k++) {
        var b = boxes[k];
        if (b.length < 2) continue;
        var r = boxRange(b);
        if (r.score > bs) { bs = r.score; bi = k; bch = r.ch; }
      }
      if (bi < 0 || bs <= 0) break;
      var box = boxes[bi], ch = bch;
      box.sort(function (a, c) { return a[ch] - c[ch]; });
      var mid = box.length >> 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    var pal = [];
    for (var j = 0; j < boxes.length; j++) pal.push(boxAvg(boxes[j]));
    while (pal.length < maxColors) pal.push([0, 0, 0]);
    return pal;
  }

  function nearest(r, g, b, pal) {
    var bi = 0, bd = Infinity;
    for (var i = 0; i < pal.length; i++) {
      var p = pal[i];
      var dr = r - p[0], dg = g - p[1], db = b - p[2];
      var d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; bi = i; if (d === 0) break; }
    }
    return bi;
  }

  /* data: RGBA bytes -> Uint8Array of palette indices (256-entry palette). */
  function indexMap(data, W, H, pal) {
    var out = new Uint8Array(W * H);
    var cache = new Map();
    for (var i = 0; i < W * H; i++) {
      var o = i << 2;
      var r = data[o], g = data[o + 1], b = data[o + 2];
      if (data[o + 3] < 128) { r = 255; g = 255; b = 255; }
      var key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      var idx = cache.get(key);
      if (idx === undefined) { idx = nearest(r, g, b, pal); cache.set(key, idx); }
      out[i] = idx;
    }
    return out;
  }

  /* px: Uint8Array of palette indices -> array of bytes (LZW-compressed stream). */
  function lzwEncode(px, minCodeSize) {
    var clear = 1 << minCodeSize, end = clear + 1;
    var codeSize = minCodeSize + 1;
    var dict = new Map();
    var next = end + 1;
    var outBytes = [];
    var cur = 0, curBits = 0;

    function emit(code) {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) { outBytes.push(cur & 255); cur >>>= 8; curBits -= 8; }
    }
    function reset() { dict = new Map(); next = end + 1; codeSize = minCodeSize + 1; }

    emit(clear); reset();
    var prefix = px[0];
    for (var i = 1; i < px.length; i++) {
      var k = px[i];
      var key = prefix * 4096 + k;
      var v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); reset(); }
      else {
        if (next >= (1 << codeSize) && codeSize < 12) codeSize++;
        dict.set(key, next++);
      }
      prefix = k;
    }
    emit(prefix);
    emit(end);
    if (curBits > 0) outBytes.push(cur & 255);
    return outBytes;
  }

  /* frames: [{palette:[256][r,g,b], pixels:Uint8Array}], delay in 1/100 s, loop 0=forever */
  function buildGIF(frames, W, H, delayCs, loop) {
    var out = [];
    function w2(v) { return [v & 255, (v >> 8) & 255]; }
    out.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);           // GIF89a
    out.push(w2(W)[0], w2(W)[1], w2(H)[0], w2(H)[1]);
    out.push(0x70, 0x00, 0x00);                              // no GCT, 8-bit color res
    var app = [0x21, 0xFF, 0x0B];                            // NETSCAPE2.0 loop
    var sig = 'NETSCAPE2.0';
    for (var s = 0; s < sig.length; s++) app.push(sig.charCodeAt(s));
    app.push(3, 1, (loop || 0) & 255, ((loop || 0) >> 8) & 255, 0);
    out.push.apply(out, app);
    for (var f = 0; f < frames.length; f++) {
      var fr = frames[f];
      out.push(0x21, 0xF9, 0x04, 0x04, (delayCs & 255), ((delayCs >> 8) & 255), 0x00, 0x00);
      out.push(0x2C, 0, 0, 0, 0, (W & 255), ((W >> 8) & 255), (H & 255), ((H >> 8) & 255), 0x87); // left, top, W, H, LCT-256
      for (var c = 0; c < 256; c++) {
        var p = fr.palette[c] || [0, 0, 0];
        out.push(clampByte(p[0]), clampByte(p[1]), clampByte(p[2]));
      }
      out.push(0x08); // LZW minimum code size
      var lzw = lzwEncode(fr.pixels, 8);
      for (var i = 0; i < lzw.length; i += 255) {
        var chunk = lzw.slice(i, i + 255);
        out.push(chunk.length);
        for (var j = 0; j < chunk.length; j++) out.push(chunk[j]);
      }
      out.push(0x00);
    }
    out.push(0x3B);
    return new Uint8Array(out);
  }

  return { medianCutPalette: medianCutPalette, indexMap: indexMap, buildGIF: buildGIF, lzwEncode: lzwEncode };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FCGIF;
