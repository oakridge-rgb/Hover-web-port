#!/usr/bin/env python3
"""
Liveness matrix for every player source in STORM0S Cinema (+ FATE's 3 legacy ones).
Extracts each *Iframe URL template from cinema.html, instantiates it with
TMDB 550 (Fight Club) / IMDb tt0137523, and probes each host.
Classifies: ALIVE-player / alive-shell / dead / parked / blocked / timeout.
"""
import re, json, ssl, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

SRC = '/home/z/my-project/scripts/out/stormos/cinema.html'
s = open(SRC, encoding='utf-8', errors='replace').read()

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# ---- extract URL templates per builder (movie branch) ----
builders = {}
for m in re.finditer(r'function (\w+Iframe)\([^)]*\)\s*\{', s):
    name = m.group(1)
    seg = s[m.start():m.start() + 1500]
    urls = re.findall(r'https://[^`\'"]+', seg)
    if urls:
        builders[name] = urls[0].replace('${encodeURIComponent(tmdbId)}', '550')
print('--- extracted movie URL templates ---')
for k, v in builders.items():
    print(f'{k:22s} {v[:90]}')

# ---- explicit extra probes ----
extra = {
    'FATE vidlink (imdb)': 'https://vidlink.pro/movie/tt0137523',
    'FATE vidsrc.xyz (imdb)': 'https://vidsrc.xyz/embed/movie?imdb=tt0137523',
    'FATE vidsrc.to (imdb)': 'https://vidsrc.to/embed/movie/tt0137523',
    'vidsrc.pm IMDb variant': 'https://vidsrc.pm/embed/movie/tt0137523',
    'multiembed IMDb variant': 'https://multiembed.mov/?video_id=tt0137523',
}

targets = {}
for name, tpl in builders.items():
    targets[name] = tpl
targets.update(extra)

MARKERS_PARK = ['domain for sale', 'buy this domain', 'parking', 'future home of', 'sedo', 'hugedomains']
MARKERS_CF = ['just a moment', 'challenge-platform', 'cf-chl', 'attention required']
MARKERS_PLAYER = ['jwplayer', 'vidlink', 'plyr', 'video-js', 'videojs', '<video', 'player.html', '/embed', 'hls.js', 'artplayer', 'vidstack', 'flowplayer', 'mediaelement', 'clappr', 'player.div']

def probe(item):
    name, url = item
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'text/html,*/*',
        'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://storm0s.netlify.app/'})
    try:
        with urllib.request.urlopen(req, timeout=10, context=CTX) as r:
            body = r.read(60000).decode('utf-8', errors='replace')
            code, final = r.status, r.url
    except urllib.error.HTTPError as e:
        try: body = e.read(60000).decode('utf-8', errors='replace')
        except Exception: body = ''
        code, final = e.code, url
    except Exception as e:
        return name, url, 'ERR', str(e)[:40], 0
    low = body.lower()
    if any(m in low for m in MARKERS_PARK): cls = 'PARKED'
    elif any(m in low for m in MARKERS_CF): cls = 'CF-CHALLENGE'
    elif any(m in low for m in MARKERS_PLAYER): cls = 'PLAYER-MARKERS'
    elif code == 200 and len(body) > 500: cls = '200-SHELL(no markers)'
    else: cls = f'HTTP-{code}'
    return name, final, code, cls, len(body)

results = []
with ThreadPoolExecutor(max_workers=12) as ex:
    for row in ex.map(probe, targets.items()):
        results.append(row)
        print(f'{row[0]:26s} {row[2]} {row[3]:24s} {row[4]:7d}B  {row[1][:70]}')

json.dump({r[0]: {'code': r[2], 'class': r[3], 'final': r[1]} for r in results},
          open('/home/z/my-project/scripts/out/stormos/provider_matrix.json', 'w'), indent=1)
