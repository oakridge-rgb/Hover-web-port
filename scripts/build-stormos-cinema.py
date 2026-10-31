#!/usr/bin/env python3
"""
Build stormos-cinema.html — the STORM0S Cinema page as ONE standalone HTML file.

Source: scripts/out/stormos/cinema.html (byte-identical to the gzip+b64
'embedded-cinema' blob distributed inside the StormOS main page, so this IS the
real StormOS movie page 1:1).

Two surgical fixes applied (everything else untouched):
 1. getTmdbCredential() now reads localStorage 'milkbox_tmdb_credential' first —
    the page's own "Save & load catalog" form already saves the key there but the
    original reader never consumes it (upstream bug), so a pasted key was ignored.
 2. The bundled TMDB key is dead (TMDB returns 401 Invalid API key - revoked),
    so blank it. The page then instantly shows its native key form instead of
    doing a doomed 401 fetch on every load.
"""
import re

SRC = '/home/z/my-project/scripts/out/stormos/cinema.html'
DST = '/home/z/my-project/download/stormos-cinema.html'

s = open(SRC, encoding='utf-8', errors='replace').read()
orig_len = len(s)
changes = []

# --- Fix 1: credential reader (localStorage first, embedded key fallback) ---
old_fn = "function getTmdbCredential() { return (window.POTATOLAND_KEYS.TMDB || '').trim(); }"
new_fn = (
    "function getTmdbCredential() { "
    "try { const saved = (localStorage.getItem('milkbox_tmdb_credential') || '').trim(); "
    "if (saved) return saved; } catch {} "
    "return (window.POTATOLAND_KEYS.TMDB || '').trim(); }"
)
assert s.count(old_fn) == 1, f'getTmdbCredential found {s.count(old_fn)} times'
s = s.replace(old_fn, new_fn)
changes.append('credential reader reads saved key from localStorage')

# --- Fix 2: blank the dead embedded key ---
m = re.search(r'window\.POTATOLAND_KEYS\s*=\s*\{TMDB:atob\("[A-Za-z0-9+/=]+"\),MANGADEX:\x27\x27\};', s)
assert m, 'POTATOLAND_KEYS assignment not found'
s = s.replace(m.group(0), "window.POTATOLAND_KEYS = {TMDB:'',MANGADEX:''};")
changes.append('dead bundled TMDB key blanked (native key form shows instead)')

open(DST, 'w', encoding='utf-8').write(s)
print(f'written {DST}  ({orig_len} -> {len(s)} bytes)')
for c in changes:
    print(' -', c)

# --- sanity: still single-file (no external script tags) ---
ext = re.findall(r'<script[^>]*\bsrc=["\']([^"\']+)["\']', s)
print('external <script src> count:', len(ext), ext)
assert not ext

# --- provider inventory for the report ---
builders = sorted(set(re.findall(r'function (\w+Iframe)\(', s)))
print('iframe builders (%d):' % len(builders))
print(' ', ', '.join(builders))
hosts = sorted(set(re.findall(r'https://((?:[a-z0-9-]+\.)+[a-z]{2,})/', s)))
player_hosts = [h for h in hosts if any(k in h for k in
    ('vid', 'cine', 'embed', 'movie', 'yapgrid', 'videasy', 'superembed', 'autoembed', 'anidb', 'megavid', 'spenplayer', 'flicky', 'rivestream', 'cosmos'))]
print('player-ish hosts:', player_hosts)
