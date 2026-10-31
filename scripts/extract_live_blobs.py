#!/usr/bin/env python3
"""Decompress all embedded blobs from live StormOS; identify the movie/cinema page."""
import re, gzip, base64, zlib

s = open('/tmp/storm_live.html', encoding='utf-8', errors='replace').read()

blobs = {}
for m in re.finditer(r'<script id="([a-z0-9-]+)" type="application/octet-stream">([A-Za-z0-9+/=]+)</script>', s):
    bid, b64 = m.group(1), m.group(2)
    blobs[bid] = b64
    print(f'{bid}: b64={len(b64)}')

for bid, b64 in blobs.items():
    try:
        raw = base64.b64decode(b64)
        head = raw[:4]
        if head[:2] == b'\x1f\x8b':
            html = gzip.decompress(raw).decode('utf-8', errors='replace')
        else:
            try:
                html = zlib.decompress(raw, -15).decode('utf-8', errors='replace')
            except Exception:
                html = raw.decode('utf-8', errors='replace')
        title = re.search(r'<title[^>]*>([^<]*)</title>', html)
        tid = title.group(1) if title else '?'
        marker = ''
        for kw in ['vidsrc', 'vidphantom', 'vidlink', 'themoviedb', 'cinema', 'movie']:
            if kw in html.lower():
                marker += kw + ' '
        print(f'{bid}: decompressed={len(html)} title={tid!r} markers=[{marker}]')
        if 'vidphantom' in html or 'vidsrc' in html or 'movie' in html.lower():
            fn = f'/home/z/my-project/scripts/out/stormos/live_blob_{bid}.html'
            open(fn, 'w').write(html)
            print('   SAVED ->', fn)
    except Exception as e:
        print(f'{bid}: FAILED {e}')
