#!/usr/bin/env python3
"""Splice movies.html v2: keep v1 shell (head+css+html), swap in static-catalog JS."""
import os

V1 = '/home/z/my-project/download/fate-movies/movies.html'
JS = '/home/z/my-project/scripts/movies-v2.js'
OUT = '/home/z/my-project/download/fate-movies2/movies.html'

lines = open(V1, encoding='utf-8').read().split('\n')
# v1: line 292 (1-based) = toast div; keep 1..292 -> python slice [0:292]
shell = '\n'.join(lines[:292])
assert '<div class="toast" id="toast"></div>' in shell, 'shell cut wrong'
assert '<script>' in lines[293], 'script opener not where expected: ' + lines[293]

# 1. catalog script tag after pass.js (defer: loads after parse, before DOMContentLoaded)
shell = shell.replace(
    '<script src="pass.js"></script>',
    '<script src="pass.js"></script>\n'
    '<script src="fate-movies-cat.js" defer onerror="window.__catCDN&&window.__catCDN()"></script>',
    1)

# 2. sprite CSS before the single </style>
css_add = '''/* sprite poster engine (posters ride 10x10 grids -> 13 small files) */
.mcard .poster .mp{position:absolute;inset:0;background-size:1000% 1000%;background-repeat:no-repeat;transform:scale(1.02);transition:transform .45s ease}
.mcard:hover .poster .mp{transform:scale(1.09)}
.mcard .poster .mp.noimg{display:none}
.mcard .poster .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",sans-serif;font-weight:800;font-size:3rem;color:rgba(var(--primary-rgb),0.18);background:linear-gradient(160deg,rgba(var(--panel-rgb),0.65),rgba(var(--panel2-rgb),0.92))}
.hist-card .hc-poster{position:relative;width:108px;height:160px;border-radius:10px;border:1px solid var(--glass-border);overflow:hidden;background:#0a0a0a;flex:0 0 auto}
.hist-card .hc-poster .mp{position:absolute;inset:0;background-size:1000% 1000%;background-repeat:no-repeat}
.hist-card .hc-poster .mp.noimg{display:none}
.hist-card .hc-poster .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:2rem;color:rgba(var(--primary-rgb),0.3)}
.d-poster{aspect-ratio:2/3;background-size:1000% 1000%;background-repeat:no-repeat;background-color:#0d0d0d;position:relative}
.d-poster.noimg{background-image:linear-gradient(160deg,rgba(var(--panel-rgb),0.65),rgba(var(--panel2-rgb),0.92))}
</style>'''
assert shell.count('</style>') == 1
shell = shell.replace('</style>', css_add, 1)

# 3. detail modal poster: img -> div (sprite target)
old_img = '<img class="d-poster" id="dPoster" alt="" />'
assert old_img in shell
shell = shell.replace(old_img, '<div class="d-poster" id="dPoster"></div>', 1)

# 4. append the new data-layer script
js = open(JS, encoding='utf-8').read()
html = shell + '\n\n<script>\n' + js + '\n</script>\n</body>\n</html>\n'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', OUT, f'{len(html)/1024:.0f} KB')
