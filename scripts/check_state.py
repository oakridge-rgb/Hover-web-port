#!/usr/bin/env python3
"""Check current state: does fate-movies-cat.js have tm fields? does movies.html have new PROVIDERS?"""
import re, gzip, base64, json

# 1. catalog tm check
cat = open('/home/z/my-project/download/fate-movies2/fate-movies-cat.js', encoding='utf-8').read()
m = re.search(r'window\.FATE_MOVIES_B64\s*=\s*"([^"]+)"', cat)
assert m, 'b64 not found'
raw = gzip.decompress(base64.b64decode(m.group(1)))
d = json.loads(raw)
items = d['m'] + d['s']
with_tm = sum(1 for it in items if it.get('tm'))
print(f'catalog: {len(items)} items, {with_tm} with tm field, keys sample: {sorted(items[0].keys())}')

# 2. deployed movies.html provider check
html = open('/home/z/my-project/download/fate-movies2/movies.html', encoding='utf-8', errors='replace').read()
print('movies.html has vidsrc.pm provider:', "vidsrc.pm" in html)
print('movies.html has FATE legacy vidsrc.xyz:', "vidsrc.xyz" in html)
print('movies.html has usableProviders:', 'usableProviders' in html)
print('movies.html has m.tm lookup:', '.tm' in html and 'usableProviders' in html)
print('movies.html size:', len(html))

# 3. loadFrame id resolution in movies-v2.js
v2 = open('/home/z/my-project/scripts/movies-v2.js', encoding='utf-8').read()
i = v2.find('function loadFrame')
print('--- loadFrame ---')
print(v2[i:i+700])
