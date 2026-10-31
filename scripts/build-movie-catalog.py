#!/usr/bin/env python3
"""Build FATE static movie catalog from Cinemeta (keyless) + metahub posters.
Output: fate-movies-cat.js (gzip+b64) + msheets/sheet-N.jpg sprite sheets."""
import json, gzip, base64, io, os, sys, time, re, random
import urllib.request, urllib.parse
import concurrent.futures as cf
from PIL import Image

OUT_DIR = '/home/z/my-project/download/fate-movies2'
SHEET_DIR = os.path.join(OUT_DIR, 'msheets')
os.makedirs(SHEET_DIR, exist_ok=True)

BASE = 'https://v3-cinemeta.strem.io'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

MOVIE_GENRES = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama',
                'Family','Fantasy','History','Horror','Music','Mystery','Romance','Sci-Fi',
                'Thriller','War','Western']
SERIES_GENRES = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama',
                 'Family','Kids','Mystery','Reality','Sci-Fi & Fantasy','War']
CAP_M, CAP_S = 850, 650
CELL_W, CELL_H = 154, 231
GRID = 10  # 10x10 = 100 posters per sheet

def fetch(url, timeout=25, tries=3):
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode('utf-8', 'replace'))
        except Exception as e:
            if a == tries - 1:
                print(f'  FAIL {url[:110]} -> {e}')
                return None
            time.sleep(1.2 * (a + 1))

def cover_crop(img, w, h):
    """Resize+crop to exactly w x h (cover)."""
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    nw, nh = max(w, round(iw * scale)), max(h, round(ih * scale))
    img = img.convert('RGB').resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return img.crop((left, top, left + w, top + h))

# ---------- 1. fetch catalog pages ----------
tasks = []  # (priority, kind, cat, genre, skip)
prio = 0
for kind, genres, cap in (('movie', MOVIE_GENRES, CAP_M), ('series', SERIES_GENRES, CAP_S)):
    for cat, skips in (('top', (0, 100, 200)), ('year', (0, 100)), ('imdbRating', (0, 100))):
        for sk in skips:
            tasks.append((prio, kind, cat, '', sk)); prio += 1
    for g in genres:
        tasks.append((prio, kind, 'top', g, 0)); prio += 1

def run_task(t):
    _, kind, cat, genre, sk = t
    parts = []
    if genre: parts.append('genre=' + urllib.parse.quote(genre))
    if sk: parts.append('skip=' + str(sk))
    path = '/catalog/' + kind + '/' + cat + ('/' + '&'.join(parts) if parts else '') + '.json'
    d = fetch(BASE + path)
    return (t, (d or {}).get('metas') or [])

print(f'fetching {len(tasks)} catalog pages...')
raw = {'movie': [], 'series': []}
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    for t, metas in ex.map(run_task, tasks):
        raw[t[1]].extend(metas)
print('raw metas: movie', len(raw['movie']), '/ series', len(raw['series']))

# ---------- 2. dedupe + clean (keep top-popularity order) ----------
def clean(m, typ):
    imdb = m.get('imdb_id') or m.get('id')
    if not imdb or not imdb.startswith('tt') or not m.get('name'):
        return None
    if not (m.get('poster') or '').startswith('http'):
        return None  # no poster -> skip entirely, plenty of titles
    year = None
    for src in (m.get('releaseInfo'), m.get('year')):
        mt = re.search(r'(19|20)\d{2}', str(src or ''))
        if mt: year = int(mt.group(0)); break
    try: r = float(m.get('imdbRating')) if m.get('imdbRating') else None
    except Exception: r = None
    g = m.get('genres') or m.get('genre') or []
    if isinstance(g, str): g = [g]
    g = [x for x in g if x and len(x) < 25][:3]
    d = re.sub(r'\s+', ' ', m.get('description') or '').strip()[:240]
    c = [x for x in (m.get('cast') or []) if isinstance(x, str)][:4]
    return {'i': imdb, 'n': m['name'].strip()[:90], 't': typ, 'y': year, 'r': r,
            'g': g, 'd': d, 'ru': (m.get('runtime') or '')[:20], 'c': c}

seen = set()
items = {'movie': [], 'series': []}
for typ in ('movie', 'series'):
    for m in raw[typ]:
        it = clean(m, 'm' if typ == 'movie' else 's')
        if not it or it['i'] in seen: continue
        seen.add(it['i'])
        items[typ].append(it)
print('deduped: movie', len(items['movie']), '/ series', len(items['series']))
items['movie'] = items['movie'][:CAP_M]
items['series'] = items['series'][:CAP_S]
allitems = items['movie'] + items['series']
print('final items:', len(allitems))

# ---------- 3. series season/episode counts ----------
series_ids = [it['i'] for it in items['series']]
def season_map(imdb):
    d = fetch(f'{BASE}/meta/series/{imdb}.json', timeout=20, tries=2)
    vids = ((d or {}).get('meta') or {}).get('videos') or []
    sm = {}
    for v in vids:
        s, e = v.get('season'), v.get('episode')
        if isinstance(s, int) and s >= 1 and isinstance(e, int):
            sm[s] = max(sm.get(s, 0), e)
    if not sm: return None
    return ','.join(f'{k}:{sm[k]}' for k in sorted(sm))
print(f'fetching {len(series_ids)} series metas...')
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    for imdb, sm in zip(series_ids, ex.map(season_map, series_ids)):
        for it in items['series']:
            if it['i'] == imdb:
                if sm: it['sp'] = sm
                break

# ---------- 4. posters -> sprite sheets ----------
def dl_poster(it):
    url = f'https://images.metahub.space/poster/small/{it["i"]}/img'
    for a in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                data = r.read()
            img = Image.open(io.BytesIO(data))
            return cover_crop(img, CELL_W, CELL_H)
        except Exception as e:
            time.sleep(0.8 * (a + 1))
    return None

print(f'downloading {len(allitems)} posters...')
posters = {}
fails = []
with cf.ThreadPoolExecutor(max_workers=10) as ex:
    futs = {ex.submit(dl_poster, it): it for it in allitems}
    done_n = 0
    for f in cf.as_completed(futs):
        it = futs[f]
        try: img = f.result()
        except Exception: img = None
        if img is None: fails.append(it['i'])
        else: posters[it['i']] = img
        done_n += 1
        if done_n % 250 == 0: print(f'  {done_n}/{len(allitems)} posters')
print('posters ok:', len(posters), 'failed:', len(fails))

# assign sprite slots in catalog order
idx = 0
for it in allitems:
    if it['i'] in posters:
        it['x'] = idx; idx += 1
    else:
        it['x'] = -1
n_sheets = (idx + GRID * GRID - 1) // (GRID * GRID)
print('sprite slots:', idx, '-> sheets:', n_sheets)

slotted = [it for it in allitems if it['x'] >= 0]  # slot order == x order
for s in range(n_sheets):
    sheet = Image.new('RGB', (CELL_W * GRID, CELL_H * GRID), (16, 12, 6))
    for slot in range(GRID * GRID):
        gi = s * GRID * GRID + slot
        if gi >= idx: break
        col, row = slot % GRID, slot // GRID
        sheet.paste(posters[slotted[gi]['i']], (col * CELL_W, row * CELL_H))
    path = os.path.join(SHEET_DIR, f'sheet-{s}.jpg')
    sheet.save(path, 'JPEG', quality=82, optimize=True)

# ---------- 5. emit catalog js ----------
for it in allitems:
    if not it['d']: it.pop('d', None)
    if not it['ru']: it.pop('ru', None)
    if not it['c']: it.pop('c', None)
    if it['r'] is None: it.pop('r', None)
    if not it['g']: it.pop('g', None)
    if it['y'] is None: it.pop('y', None)

cat = {'v': 1, 'gm': MOVIE_GENRES, 'gs': SERIES_GENRES,
       'm': items['movie'], 's': items['series']}
blob = json.dumps(cat, separators=(',', ':'), ensure_ascii=False)
gz = gzip.compress(blob.encode('utf-8'), 9)
b64 = base64.b64encode(gz).decode('ascii')
js = '/* FATE static movie catalog - baked ' + time.strftime('%Y-%m-%d') + ' */\n'
js += 'window.FATE_MOVIES_B64="' + b64 + '";\n'
with open(os.path.join(OUT_DIR, 'fate-movies-cat.js'), 'w') as f:
    f.write(js)

sz = os.path.getsize(os.path.join(OUT_DIR, 'fate-movies-cat.js'))
sheet_bytes = sum(os.path.getsize(os.path.join(SHEET_DIR, f'sheet-{s}.jpg')) for s in range(n_sheets))
print(f'catalog js: {sz/1024:.0f} KB | sheets: {n_sheets} files, {sheet_bytes/1048576:.1f} MB total')
print('DONE')
