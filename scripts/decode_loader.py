#!/usr/bin/env python3
"""Decode the double-base64 loader in upload/index.html and list its real source URLs."""
import base64, re

SRC = '/home/z/my-project/upload/index.html'

html = open(SRC, encoding='utf-8').read()

# Layer 1: the "encoded" variable -> loader page
m = re.search(r'let encoded = "([^"]+)"', html, re.S)
assert m, 'encoded var not found'
loader = base64.b64decode(m.group(1)).decode('utf-8')
open('/home/z/my-project/scripts/loader_decoded.html', 'w', encoding='utf-8').write(loader)
print('=== loader page decoded, %d chars, saved to scripts/loader_decoded.html ===' % len(loader))

# The loader fetches an array of base64-encoded URLs
mu = re.search(r'const u=\[(.*?)\]', loader, re.S) or re.search(r'u=\[(.*?)\]', loader, re.S)
assert mu, 'url array not found'
raw = re.findall(r'"([^"]+)"', mu.group(1))
print('\n=== %d source URLs (after atob) ===' % len(raw))
for i, x in enumerate(raw):
    try:
        url = base64.b64decode(x).decode('utf-8')
    except Exception as e:
        url = '<decode fail: %s>' % e
    print(f'{i:2d}. {url}')

# Also note the loader's validation thresholds
for key in ('est', 'stall', 'minLen'):
    mk = re.search(key + r'=([0-9]+)', loader)
    if mk:
        print(f'{key} = {mk.group(1)}')
