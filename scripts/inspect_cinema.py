#!/usr/bin/env python3
"""Inspect cinema.html: external deps, TMDB config, structure."""
import re

s = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()
print('SIZE:', len(s))

print('SCRIPT SRC TAGS:', re.findall(r'<script[^>]*\bsrc=["\']([^"\']+)["\']', s))
print('LINK HREFS:', [m[:100] for m in re.findall(r'<link[^>]*href=["\']([^"\']+)["\']', s)][:12])
print('IMG SRCS:', re.findall(r'<img[^>]*\bsrc=["\']([^"\']+)["\']', s)[:10])
print('N script blocks:', s.count('<script'))

# TMDB endpoints (simple find, no heavy regex)
idx = 0
count = 0
while count < 12:
    i = s.find('api.themoviedb.org', idx)
    if i < 0:
        break
    print('TMDB EP @', i, ':', s[i-60:i+130].replace('\n', ' '))
    idx = i + 1
    count += 1

# api key patterns (fixed-length simple)
for pat in [r'api_key=([a-zA-Z0-9]{20,40})', r'["\']?api_key["\']?\s*[:=]\s*["\']([a-zA-Z0-9]{20,40})["\']']:
    for m in re.finditer(pat, s):
        print('APIKEY:', m.group(1))

# how is the catalog fetched - look for fetch( near themoviedb
for m in re.finditer(r'fetch\([^)]{0,200}\)', s):
    t = m.group(0)
    if 'themoviedb' in t or 'tmdb' in t.lower():
        print('FETCH:', t[:200])
