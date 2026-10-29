#!/usr/bin/env python3
"""Build FATE arcade catalog v3 — jsDelivr-ONLY edition (user directive 2026-10-29).
"we only want cdns like jsdelivr because if it isn't, itll probably get blocked"

Rules:
- rewrite raw.githubusercontent.com / raw.githack.com / rawcdn.githack.com -> cdn.jsdelivr.net/gh
- KEEP only URLs whose host ends with jsdelivr.net (cdn/fastly/gcore/testingcf/quantil/...)
- DROP everything else (gamemonetize 5000, github.io ~1150, crazygames, gamedistribution, itch.zone, ...)
- images: rewrite raw.* to jsDelivr, keep only jsDelivr images, else drop the field (grid falls back to letter tile)
- dedupe by URL
- sample-probe rewritten + plain jsDelivr URLs for liveness
- emit v8.2-deploy/fate-games-cat.js (gzip+base64 JSON [{n,u,i,s,k}])
"""
import json, base64, gzip, re, random, urllib.request, concurrent.futures
from collections import Counter

random.seed(42)
cat = json.load(open('/tmp/storm-catalog.json'))
print('raw entries:', len(cat))

RAW_RX = re.compile(r'^https://(?:raw\.githubusercontent\.com|raw(?:cdn)?\.githack\.com)/([^/]+)/([^/]+)/([^/]+)/(.+)$')
def to_jsdelivr(u):
    m = RAW_RX.match(u or '')
    if m:
        return f'https://cdn.jsdelivr.net/gh/{m.group(1)}/{m.group(2)}@{m.group(3)}/{m.group(4)}'
    return u

def on_jsdelivr(u):
    m = re.match(r'^https://([^/]+)/', u or '')
    return bool(m) and m.group(1).lower().endswith('jsdelivr.net')

out, seen = [], set()
dropped_host = dropped_dup = 0
img_src = Counter()
for g in cat:
    u = to_jsdelivr(g.get('url') or '')
    if not on_jsdelivr(u):
        dropped_host += 1
        continue
    if u in seen:
        dropped_dup += 1
        continue
    seen.add(u)
    e = {'n': (g.get('name') or 'Untitled').strip() or 'Untitled', 'u': u, 's': g['source']}
    img = to_jsdelivr(g.get('image') or '')
    if img.startswith('https://cdn.jsdelivr.net/'):
        e['i'] = img
        img_src['jsdelivr'] += 1
    else:
        img_src['none' if not g.get('image') else 'dropped'] += 1
    if g.get('kind') and g['kind'] != 'arcade':
        e['k'] = g['kind']
    out.append(e)

libs = sorted({e['s'] for e in out})
print(f'kept {len(out)} games / {len(libs)} libraries')
print(f'dropped: {dropped_host} non-jsDelivr, {dropped_dup} duplicate-URL')
print('images:', dict(img_src))

# ---- liveness QA ----
# plain cdn.jsdelivr.net entries: sample 12 (pools were 200 in recon probes)
# rewritten-from-raw/githack entries: probe EVERY one (5/10 dead in sample) - drop 404/410
rewritten = {g['u'] for g in out}
raw_srcs = {to_jsdelivr(g.get('url') or '') for g in cat if RAW_RX.match(g.get('url') or '')}
def probe(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'})
        r = urllib.request.urlopen(req, timeout=12)
        return r.status
    except Exception as e:
        return getattr(e, 'code', None) or 'ERR'

def probe_dead(u):
    s = probe(u)
    if s in (404, 410):
        return u            # confirmed dead
    if s == 200:
        return None
    # 403/429/ERR can be rate limiting -> wait and retry once
    import time; time.sleep(1.5)
    s2 = probe(u)
    if s2 in (404, 410) or (s2 != 200 and s2 != 'ERR' and s == s2):
        return u            # two consistent non-200s -> dead
    return None

plain_pool = [e['u'] for e in out if e['u'] not in raw_srcs]
rw_pool = [e['u'] for e in out if e['u'] in raw_srcs]
sample = random.sample(plain_pool, min(12, len(plain_pool)))
with concurrent.futures.ThreadPoolExecutor(12) as ex:
    st = list(ex.map(probe, sample))
print(f'probe plain cdn (sample): {sum(1 for s in st if s == 200)}/{len(st)} HTTP 200')

print(f'full-probing {len(rw_pool)} rewritten raw/githack URLs ...')
dead = set()
with concurrent.futures.ThreadPoolExecutor(24) as ex:
    for i, u in enumerate(ex.map(probe_dead, rw_pool), 1):
        if u: dead.add(u)
        if i % 200 == 0: print(f'  ...{i}/{len(rw_pool)} probed, {len(dead)} dead')
before = len(out)
out = [e for e in out if e['u'] not in dead]
print(f'rewritten-pool purge: -{before - len(out)} dead entries, {len(dead)} unique dead URLs')

libs = sorted({e['s'] for e in out})
print(f'FINAL: {len(out)} games / {len(libs)} libraries - 100% jsDelivr')

blob = json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode()
gz = gzip.compress(blob, 9)
b64 = base64.b64encode(gz).decode()
print(f'json {len(blob)//1024} KB -> gz {len(gz)//1024} KB -> b64 {len(b64)//1024} KB')

js = (
    '/* fate-games-cat.js - FATE Arcade catalog v3 (gzipped+base64) - jsDelivr-ONLY\n'
    " * decode: atob -> DecompressionStream('gzip') -> JSON of [{n:name,u:url,i:image,s:source,k:kind}]\n"
    ' * every URL is served from *.jsdelivr.net (raw.githubusercontent/githack rewritten to /gh/).\n'
    ' * non-jsDelivr hosts dropped (gamemonetize 5000, github.io, crazygames, gamedistribution, itch.zone, ...)\n'
    ' * generated 2026-10-29\n'
    ' */\n'
    f"window.FATE_GAMES_META={{count:{len(out)},libraries:{len(libs)},built:'2026-10-29',cdn:'jsdelivr-only'}};\n"
    f'window.FATE_GAMES_B64="{b64}";\n'
)
open('/home/z/my-project/download/v8.2-deploy/fate-games-cat.js', 'w').write(js)
print('written -> v8.2-deploy/fate-games-cat.js')
print('\nlibraries:')
for l in sorted(libs, key=lambda x: -sum(1 for e in out if e['s'] == x)):
    print(f"  {sum(1 for e in out if e['s']==l):5d}  {l}")
