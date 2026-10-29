#!/usr/bin/env python3
"""Splice: replace the jet/wisp engine block (lines 238-779) in games.html with the lean CDN engine."""
import io, sys

PATH = '/home/z/my-project/download/v8.2-deploy/games.html'
ENGINE = '/home/z/my-project/scripts/cdn-engine-v2.js'

lines = io.open(PATH, encoding='utf-8').read().split('\n')
# sanity-check boundaries (0-indexed: line 238 = idx 237, line 779 = idx 778, line 780 = idx 779)
assert 'const FATE_WISP_SERVERS' in lines[237], 'start boundary mismatch: ' + lines[237][:60]
assert lines[779] == '</script>', 'end boundary mismatch: ' + repr(lines[779][:40])
assert lines[780] == '<script>', 'post boundary mismatch: ' + repr(lines[780][:40])

engine = io.open(ENGINE, encoding='utf-8').read().rstrip('\n')
out = lines[:237] + engine.split('\n') + lines[779:]
io.open(PATH, 'w', encoding='utf-8').write('\n'.join(out))
print('spliced OK: new length =', len(out), 'lines')
# show the seam
print('--- seam ---')
for i in range(230, 240):
    print(i + 1, ':', out[i][:70])
