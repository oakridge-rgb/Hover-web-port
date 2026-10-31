#!/usr/bin/env python3
"""Concrete probe: every provider with a REAL movie URL (TMDB 550 / IMDb tt0137523)."""
import json, ssl, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
CTX = ssl.create_default_context(); CTX.check_hostname = False; CTX.verify_mode = ssl.CERT_NONE

targets = {
  # StormOS primary set (TMDB ids)
  'vidphantom (TMDB)':      'https://vidphantom.com/movie/550',
  'vidsrc.pm (TMDB)':       'https://vidsrc.pm/embed/movie/550',
  'cinesrc.st (TMDB)':      'https://www.cinesrc.st/embed/movie/550',
  'vidsrc.sbs (TMDB)':      'https://vidsrc.sbs/embed/movie/550',
  'vidcore.org (TMDB)':     'https://vidcore.org/embed/movie/550',
  'videasy (TMDB)':         'https://player.videasy.to/movie/550',
  'moviesapi.to (TMDB)':    'https://moviesapi.to/movie/550',
  'autoembed (TMDB)':       'https://autoembed.app/movie/tmdb/550',
  'yapgrid (TMDB)':         'https://yapgrid.com/embed/movie/550',
  'embedflix (TMDB)':       'https://embedflix.net/movie/550',
  'vidspark.to (TMDB)':     'https://vidspark.to/movie/550',
  'vidrock.ru (TMDB)':      'https://vidrock.ru/movie/550',
  'vidflix.club (TMDB)':    'https://vidflix.club/movie/550',
  'vidlux.xyz (TMDB)':      'https://vidlux.xyz/embed/movie/550',
  'vidsrcme.ru (TMDB)':     'https://vidsrcme.ru/embed/movie/550',
  'vidsrc.in (TMDB)':       'https://vidsrc.in/embed/movie/550',
  'vidsrc.io (TMDB)':       'https://vidsrc.io/embed/movie/550',
  'vsembed.ru (TMDB)':      'https://vsembed.ru/embed/movie/550',
  'toustream (TMDB)':       'https://toustream.xyz/movie/550',
  '2embed.cc (TMDB)':       'https://www.2embed.cc/embed/movie/550',
  'embed.su->vidsrc.to':    'https://vidsrc.to/embed/movie/550',
  # IMDb-id accepting
  'vidlink (IMDb)':         'https://vidlink.pro/movie/tt0137523',
  'vidsrc.pm (IMDb)':       'https://vidsrc.pm/embed/movie/tt0137523',
  'vidsrc.xyz (IMDb)':      'https://vidsrc.xyz/embed/movie?imdb=tt0137523',
  'multiembed (IMDb)':      'https://multiembed.mov/?video_id=tt0137523',
  'multiembed (TMDB)':      'https://multiembed.mov/?video_id=550&tmdb=1',
}
MARKERS_PARK = ['domain for sale', 'buy this domain', 'future home of', 'sedo', 'hugedomains', 'parkingcrew', 'afternic']
MARKERS_CF = ['just a moment', 'challenge-platform', 'cf-chl', 'attention required', 'enable javascript and cookies']
MARKERS_PLAYER = ['jwplayer', 'vidlink', 'plyr', 'video-js', 'videojs', '<video', 'player.html', 'hls.js', 'artplayer', 'vidstack', 'clappr', '/server/', 'sources', 'e1-player', 'mpegts']

def probe(item):
    name, url = item
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*',
        'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://storm0s.netlify.app/'})
    try:
        with urllib.request.urlopen(req, timeout=12, context=CTX) as r:
            body = r.read(80000).decode('utf-8', errors='replace'); code, final = r.status, r.url
    except urllib.error.HTTPError as e:
        try: body = e.read(80000).decode('utf-8', errors='replace')
        except Exception: body = ''
        code, final = e.code, url
    except Exception as e:
        return name, url, 'ERR', ('DNS/TIMEOUT: ' + str(e)[:60]), 0
    low = body.lower()
    if any(m in low for m in MARKERS_PARK): cls = 'PARKED'
    elif any(m in low for m in MARKERS_CF): cls = 'CF-CHALLENGE(bot-block)'
    elif any(m in low for m in MARKERS_PLAYER): cls = 'PLAYER-OK'
    elif code == 200 and len(body) > 800: cls = '200-SHELL'
    else: cls = f'HTTP-{code}'
    return name, final, code, cls, len(body)

with ThreadPoolExecutor(max_workers=13) as ex:
    rows = list(ex.map(probe, targets.items()))
alive = 0
for name, final, code, cls, size in sorted(rows, key=lambda r: (r[3] != 'PLAYER-OK', r[0])):
    mark = '>>>' if cls == 'PLAYER-OK' else '   '
    print(f'{mark} {name:24s} {str(code):>3} {cls:22s} {size:7d}B')
    if cls == 'PLAYER-OK': alive += 1
print(f'\n{alive}/{len(rows)} sources look alive (with player markers)')
json.dump({n: {'code': c, 'class': k, 'final': f} for n, f, c, k, s in rows},
          open('/home/z/my-project/scripts/out/stormos/provider_matrix.json', 'w'), indent=1)
