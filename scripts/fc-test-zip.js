const FCZIP = require('./fc-zip.js');
const fs = require('fs');

const files = [
  { name: 'a.txt', data: new TextEncoder().encode('hello world') },
  { name: 'frame_0001.bin', data: new Uint8Array([1, 2, 3, 255, 0, 128, 7]) },
  { name: 'frame_0002.bin', data: new Uint8Array(70000).map((_, i) => i % 251) },
];

const blob = FCZIP.makeZip(files);
blob.arrayBuffer().then((ab) => {
  fs.writeFileSync('/tmp/fc_test.zip', Buffer.from(ab));
  console.log('zip bytes:', ab.byteLength);
  console.log('OK');
});
