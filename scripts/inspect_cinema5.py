#!/usr/bin/env python3
"""Scan cinema.html: localStorage keys, catalog caching, custom URL playback."""
import re

s = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()

print('=== localStorage.setItem keys ===')
keys = set(re.findall(r'(?:localStorage|ls)\.setItem\(\s*[\'"]([a-z0-9_]+)[\'"]', s))
print(sorted(keys))
print()
print('=== localStorage.getItem keys ===')
gkeys = set(re.findall(r'(?:localStorage|ls)\.getItem\(\s*[\'"]([a-z0-9_]+)[\'"]', s))
print(sorted(gkeys))
print()
# catalog cache?
for k in sorted(gkeys | keys):
    if 'cache' in k or 'catalog' in k or 'tmdb' in k:
        print('RELEVANT KEY:', k)
# custom url / upload playback
for kw in ['uploadedUrlEps', 'customUrl', 'Custom URL', 'Upload', 'paste']:
    i = s.find(kw)
    if i >= 0:
        print(f'--- {kw} @ {i}:', s[max(0,i-100):i+200].replace('\n', ' ')[:280])
