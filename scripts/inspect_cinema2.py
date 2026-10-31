#!/usr/bin/env python3
"""Check POTATOLAND_KEYS, catalog loading, tenrai/github usage in cinema.html."""
import re

s = open('/home/z/my-project/scripts/out/stormos/cinema.html', encoding='utf-8', errors='replace').read()

def show(name, needle, n=5, before=80, after=300):
    print(f'===== {name} =====')
    idx, count = 0, 0
    while count < n:
        i = s.find(needle, idx)
        if i < 0:
            break
        print(f'--- @ {i}:')
        print(s[max(0, i-before):i+after].replace('\n', ' ')[:before+after])
        idx = i + 1
        count += 1
    if count == 0:
        print('NOT FOUND')

show('POTATOLAND_KEYS', 'POTATOLAND_KEYS', 4)
show('TENRAI', 'api.tenrai.org', 3)
show('RAWDATA', 'raw.githubusercontent.com', 4)
