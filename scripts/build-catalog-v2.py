#!/usr/bin/env python3
"""Build FATE arcade catalog v2 from the decoded Storm0S catalog.
- drop entries without http URLs (embedded extras)
- drop hosts proven dead or hard-blocked (probe results)
- rewrite raw.githubusercontent.com -> cdn.jsdelivr.net/gh (fetch-mode friendly)
- dedupe by URL
- spot-check GhostProxy + Zones libraries with real GETs
- emit fate-games-cat.js: window.FATE_GAMES_META + FATE_GAMES_B64 (gzip+base64 of JSON [{n,u,i,s}])
"""
import json, base64, gzip, io, re, random, urllib.request, concurrent.futures
from urllib.parse import urlparse

random.seed(42)
cat = json.load(open('/tmp/storm-catalog.json'))
print('loaded', len(cat), 'entries')

DROP_HOSTS = {
    # probed 404/410 — host-level dead
    'basketrandomonline.github.io', 'boxingrandom.github.io', 'georgioklironomos.itch.io',
    'ejvd3326248pklq0mtj313irgbc2vsrb-a-sites-opensocial.googleusercontent.com', 'h52304.github.io',
    'html.itch.zone', 'mathgames66.github.io', 'mcv152.netlify.app', 'mcv18.netlify.app',
    'probablykam.github.io', 'run3.io', 'soccer-random.github.io', 'subwaysurfersonlinegame.github.io',
    'temple-of-boom.github.io', 'tombofthemask.github.io', 'webglmath.github.io', 'hl2.slqnt.dev',
    'jptragar.glitch.me',
    # probed XFO-locked AND no CORS — cannot embed, cannot fetch
    '8ballpool.com', 'humanornot.so', 'now.gg', 'totaljerkface.com', 'www.coolmathgames.com',
    'www.mathplayground.com', 'www.silvergames.com', 'f.silvergames.com', 'f3.silvergames.com',
    'ud-gles3games.shared-osj.k8s.n2i.io',
    'bippinbits.itch.io', 'collarpill.itch.io', 'ddkirbyisq.itch.io', 'donitz.itch.io',
    'kindanice.itch.io', 'kodub.itch.io', 'stepford.itch.io',
    # junk
    'example.com',
}

def rewrite(u):
    m = re.match(r'^https://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+)$', u)
    if m:
        return f'https://cdn.jsdelivr.net/gh/{m.group(1)}/{m.group(2)}@{m.group(3)}/{m.group(4)}'
    return u

def get_status(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'})
        r = urllib.request.urlopen(req, timeout=12)
        return r.status
    except Exception as e:
        return getattr(e, 'code', None) or 'ERR'

# spot-check libraries whose liveness was ambiguous
def check_lib(source, urls, n=3):
    sample = random.sample(urls, min(n, len(urls)))
    with concurrent.futures.ThreadPoolExecutor(n) as ex:
        st = list(ex.map(get_status, sample))
    ok = sum(1 for s in st if s == 200)
    print(f'  {source}: {ok}/{len(st)} GET 200 -> {"KEEP" if ok > 0 else "DROP"}')
    return ok > 0

by_src = {}
for g in cat:
    u = g.get('url') or ''
    if not u.startswith('http'):
        continue
    by_src.setdefault(g['source'], []).append(u)

checked = {}
for lib in ('GhostProxy', 'Zones', 'CVK', 'STORM0S', 'Noah', 'CCPorted', 'Unblocked Zone'):
    if lib in by_src:
        checked[lib] = check_lib(lib, by_src[lib])

out, seen = [], set()
dropped_host = dropped_lib = dropped_dup = 0
for g in cat:
    u = g.get('url') or ''
    if not u.startswith('http'):
        continue
    src = g['source']
    if src in checked and not checked[src]:
        dropped_lib += 1
        continue
    u = rewrite(u)
    host = urlparse(u).netloc
    if host in DROP_HOSTS:
        dropped_host += 1
        continue
    if u in seen:
        dropped_dup += 1
        continue
    seen.add(u)
    e = {'n': g.get('name') or 'Untitled', 'u': u, 's': src}
    if g.get('image'):
        e['i'] = g['image']
    if g.get('kind') and g['kind'] != 'arcade':
        e['k'] = g['kind']
    out.append(e)

libs = sorted({e['s'] for e in out})
print(f'\nkept {len(out)} games / {len(libs)} libraries')
print(f'dropped: {dropped_host} dead-host, {dropped_lib} dead-library, {dropped_dup} duplicate-URL')

blob = json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode()
gz = gzip.compress(blob, 9)
b64 = base64.b64encode(gz).decode()
print(f'json {len(blob)//1024} KB -> gz {len(gz)//1024} KB -> b64 {len(b64)//1024} KB')

js = (
    '/* fate-games-cat.js - FATE Arcade catalog v2 (gzipped+base64)\n'
    " * decode: atob -> DecompressionStream('gzip') -> JSON of [{n:name,u:url,i:image,s:source,k:kind}]\n"
    ' * hosts verified via probe (dead/XFO-locked hosts removed; raw.githubusercontent rewritten to jsDelivr)\n'
    ' * generated 2026-10-29\n'
    ' */\n'
    f'window.FATE_GAMES_META={{count:{len(out)},libraries:{len(libs)},built:\'2026-10-29\'}};\n'
    f'window.FATE_GAMES_B64="{b64}";\n'
)
open('/home/z/my-project/download/v8.2-deploy/fate-games-cat.js', 'w').write(js)
print('written -> v8.2-deploy/fate-games-cat.js')
print('\nlibraries:')
for l in libs:
    print(f"  {sum(1 for e in out if e['s']==l):5d}  {l}")
