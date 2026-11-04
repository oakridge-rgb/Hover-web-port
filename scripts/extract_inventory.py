#!/usr/bin/env python3
"""Extract the full inventory of the gn-math payload."""
import re, json, os

d = open('/home/z/my-project/scripts/payload.html', encoding='utf-8', errors='replace').read()
OUT = '/home/z/my-project/download/gn-math-extracted'
os.makedirs(OUT, exist_ok=True)

report = []

# ---------- 1) local documents mE (embedded HTML pages) ----------
m = re.search(r'mE=\{', d)
if m:
    # keys are string literals mapping to template literals; find all "https://gn.local/..." style keys
    keys = re.findall(r'"(https://[^"]+)"\s*:\s*`', d[m.start():m.start()+200000])
    print('mE local doc keys:', keys)

# find each template literal that starts with <!doctype after a key
docs = {}
for km in re.finditer(r'"(https://gn\.local/[^"]+)"\s*:\s*`', d):
    key = km.group(1)
    start = km.end()
    # find matching closing backtick (template literals here don't use ${} escapes often; scan for unescaped `)
    j = start
    depth_ok = True
    while True:
        k = d.find('`', j)
        if k < 0:
            break
        # count preceding backslashes
        bs = 0
        p = k - 1
        while d[p] == '\\':
            bs += 1; p -= 1
        if bs % 2 == 0:
            break
        j = k + 1
    docs[key] = d[start:k]

print('\n=== local documents ===')
for k, v in docs.items():
    print(f'{k}  ->  {len(v):8d} chars')
    fname = k.split('/')[-1]
    open(f'{OUT}/{fname}', 'w', encoding='utf-8').write(v)
    report.append(('local document', k, len(v)))

# ---------- 2) games catalog ----------
# entries look like {id:644,name:"...",cover:"{COVER_URL}/644.png",url:"{HTML_URL}/644-fix.html",author:"...",authorLink:"...",special:["fnf"]}
games = []
gm = re.finditer(r'\{id:(\d+),name:"([^"]+)",cover:"([^"]*)",url:"([^"]*)"(?:,author:"([^"]*)",authorLink:"([^"]*)")?(,special:\[[^\]]*\])?\}', d)
for g in gm:
    games.append({
        'id': int(g.group(1)), 'name': g.group(2), 'cover': g.group(3), 'url': g.group(4),
        'author': g.group(5) or '', 'special': (g.group(7) or '').strip(',')
    })
print(f'\n=== games catalog: {len(games)} entries ===')
ids = sorted({g["id"] for g in games})
if ids:
    print('id range:', ids[0], '->', ids[-1])
names = [g['name'] for g in games]
print('first 5:', names[:5])
print('last 5:', names[-5:])
json.dump(games, open(f'{OUT}/games-catalog.json', 'w'), indent=1)

# ---------- 3) songs (music app) ----------
songs = re.findall(r'\{title:"([^"]{1,80})",artist:"([^"]{1,80})"', d)
print(f'\n=== songs found: {len(songs)} ===')
for s in songs[:10]: print(' ', s)
if songs:
    json.dump([{'title': t, 'artist': a} for t, a in songs], open(f'{OUT}/songs.json', 'w'), indent=1)

# ---------- 4) wisp endpoints + apps ----------
apps = re.findall(r'\["([a-zA-Z]+)","([^"]+)","(https://[^"]+)"\]', d)
print('\n=== built-in apps ===')
for a in apps: print(' ', a)
json.dump([{'id': a, 'label': b, 'url': u} for a, b, u in apps], open(f'{OUT}/apps.json', 'w'), indent=1)

wisp = re.findall(r'wss://[\w.\-]+/[^\s\'"`,]*', d)
print('\n=== wisp endpoints ===')
for w in sorted(set(wisp)): print(' ', w)

# themes
themes = re.findall(r'(default|ocean|emerald|violet|sunset|rose|cyan|amber|red|lime|teal|sky|indigo|fuchsia|navy):"(#[0-9a-f]{6})"', d)
print('\n=== themes ===', len(set(themes)))

# ---------- 5) placeholder URL substitution ----------
for ph in ['{COVER_URL}', '{HTML_URL}']:
    sub = re.search(re.escape(ph) + r'[^"\']*', d)
    # find what replaces it
    hits = re.findall(r'(?:COVER_URL|HTML_URL)\s*[:=]\s*["\']([^"\']+)', d)
    print(ph, 'substitutions found:', sorted(set(hits))[:4])

print('\nreport items:', len(report))
