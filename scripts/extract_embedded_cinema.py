#!/usr/bin/env python3
"""Extract embedded-cinema gzip+b64 blob from STORM0S.html; check for TMDB key overrides."""
import re, gzip, base64, io

s = open('/home/z/my-project/scripts/out/stormos/STORM0S.html', encoding='utf-8', errors='replace').read()

# 1. find the embedded-cinema blob
m = re.search(r'<script id="embedded-cinema" type="application/octet-stream">([A-Za-z0-9+/=]+)</script>', s)
if not m:
    print('embedded-cinema NOT FOUND')
else:
    b64 = m.group(1)
    print('blob b64 len:', len(b64))
    raw = base64.b64decode(b64)
    print('gzip raw len:', len(raw))
    try:
        html = gzip.decompress(raw).decode('utf-8', errors='replace')
        print('decompressed len:', len(html))
        open('/home/z/my-project/scripts/out/stormos/cinema_embedded.html', 'w').write(html)
        # compare with snapshot
        snap = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()
        print('snapshot len:', len(snap))
        print('IDENTICAL to snapshot:', html == snap)
        # key check in embedded
        for mm in re.finditer(r'POTATOLAND_KEYS\s*=\s*\{[^}]*\}', html):
            print('EMBEDDED KEYS:', mm.group(0)[:200])
    except Exception as e:
        print('decompress failed:', e)

# 2. any TMDB key overrides in main page
for pat in ['POTATOLAND', 'api_key', 'TMDB']:
    hits = [m.start() for m in re.finditer(re.escape(pat), s)]
    print(f'{pat}: {len(hits)} hits in main page')
i = s.find('POTATOLAND')
while i >= 0:
    print('  MAIN @', i, ':', s[max(0,i-120):i+200].replace(chr(10),' ')[:300])
    i = s.find('POTATOLAND', i+1)
