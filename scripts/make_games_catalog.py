#!/usr/bin/env python3
"""Generate fate-games-cat.js — FATE Arcade catalog as gzip+base64 (Storm0S technique)
Output: /home/z/my-project/download/v8.2-deploy/fate-games-cat.js
"""
import json, gzip, base64, time

SRC = '/home/z/my-project/scripts/out/stormos/catalog_full.json'
OUT = '/home/z/my-project/download/v8.2-deploy/fate-games-cat.js'

lib = json.load(open(SRC, encoding='utf-8'))

# normalize: keep the fields we actually use, compact keys to save bytes
# keep: n=name, u=url, i=image, s=source, k=kind, f=fetchGame(1), F=frameFallback(1)
out = []
for e in lib:
    o = {'n': e.get('name', ''), 'u': e.get('url', ''), 's': e.get('source', '?')}
    if e.get('image'): o['i'] = e['image']
    if e.get('kind') and e['kind'] != 'arcade': o['k'] = e['kind']
    if e.get('fetchGame') is True: o['f'] = 1
    if e.get('fetchGame') is False: o['f'] = 0
    if e.get('frameFallback') is True: o['F'] = 1
    out.append(o)

raw = json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
gz = gzip.compress(raw, 9)
b64 = base64.b64encode(gz).decode('ascii')

js = (
    "/* fate-games-cat.js - FATE Arcade catalog (gzipped+base64, Storm0S technique)\n"
    " * entries: %d games / %d libraries - decode: atob -> DecompressionStream('gzip') -> JSON\n"
    " * fields: n=name u=url i=image s=source k=kind(omitted=arcade) f=fetchGame(1=yes,0=no,omit=direct) F=frameFallback\n"
    " * generated %s\n"
    " */\nwindow.FATE_GAMES_META={count:%d,libraries:%d,built:'%s'};\n"
    "window.FATE_GAMES_B64=\"%s\";\n"
) % (len(out), len(set(e['s'] for e in out)), time.strftime('%Y-%m-%d'), len(out),
     len(set(e['s'] for e in out)), time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), b64)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(js)

import os
print('entries:', len(out))
print('raw json bytes:', f'{len(raw):,}')
print('gzip bytes:', f'{len(gz):,}')
print('final js bytes:', f'{os.path.getsize(OUT):,}')
print('saved:', OUT)
