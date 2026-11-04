/* fc-zip.js — minimal STORE-method ZIP writer (for PNG sequence export). Pure JS. */
const FCZIP = (function () {
  var T = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    T[n] = c >>> 0;
  }
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = T[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(v) { return [v & 255, (v >>> 8) & 255]; }
  function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }

  /* files: [{name, data:Uint8Array}] -> Blob */
  function makeZip(files) {
    var parts = [], central = [], offset = 0;
    var enc = new TextEncoder();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var nameB = enc.encode(f.name);
      var crc = crc32(f.data), sz = f.data.length;
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0));
      parts.push(new Uint8Array(lh), nameB, f.data);
      var ch = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset));
      central.push(new Uint8Array(ch), nameB);
      offset += lh.length + nameB.length + sz;
    }
    var cdSize = 0;
    for (var j = 0; j < central.length; j++) cdSize += central[j].length;
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    return new Blob([].concat(parts, central, [eocd]), { type: 'application/zip' });
  }

  return { makeZip: makeZip, crc32: crc32 };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FCZIP;
