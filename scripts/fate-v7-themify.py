#!/usr/bin/env python3
"""FATE V7 themifier: convert hardcoded theme colors in <style> blocks
of index.html / settings.html into CSS variables so theme.js can
restyle the whole site. JS strings are left untouched (they're
handled separately by particle-theme edits)."""
import re, sys

BASE = '/home/z/my-project/download/fate-v7/'

def style_scope(html):
    """Return (prefix, css, suffix) splitting at the <style>...</style> block."""
    m = re.search(r'<style>(.*?)</style>', html, flags=re.S)
    if not m:
        raise SystemExit('no <style> block found')
    return html[:m.start(1)], m.group(1), html[m.end(1):]

def apply(css, pairs, label):
    for pat, rep in pairs:
        css, n = re.subn(pat, rep, css)
        print(f'  [{label}] {pat[:52]:<52} -> {n}')
        if n == 0:
            print(f'    !! ZERO matches for {pat}', file=sys.stderr)
    return css

# ---------- shared rgb-class replacements (both pages) ----------
RGB_PAIRS = [
    # primary orange (index) / amber (settings) family
    (r'rgba\(255,\s*122,\s*0,', 'rgba(var(--primary-rgb),'),
    (r'rgba\(255,\s*61,\s*0,',   'rgba(var(--primary-hot-rgb),'),
    (r'rgba\(255,\s*157,\s*61,', 'rgba(var(--primary-soft-rgb),'),
    (r'rgba\(245,\s*158,\s*11,', 'rgba(var(--primary-rgb),'),
    # dark surface tints (index)
    (r'rgba\(12,\s*7,\s*3,',   'rgba(var(--panel2-rgb),'),
    (r'rgba\(12,\s*6,\s*3,',   'rgba(var(--panel2-rgb),'),
    (r'rgba\(12,\s*6,\s*2,',   'rgba(var(--panel2-rgb),'),
    (r'rgba\(28,\s*13,\s*4,',  'rgba(var(--panel-rgb),'),
    (r'rgba\(14,\s*8,\s*3,',   'rgba(var(--panel-rgb),'),
    (r'rgba\(8,\s*5,\s*3,',    'rgba(var(--panel2-rgb),'),
    (r'rgba\(10,\s*5,\s*2,',   'rgba(var(--panel2-rgb),'),
    # CTA / gradient pairs (index)
    (r'linear-gradient\(135deg,\s*#ff9d1c,\s*#ff3d00\)', 'linear-gradient(135deg, var(--grad-a), var(--primary-hot))'),
    (r'linear-gradient\(135deg,\s*#ffa41c,\s*#ff6200\)', 'linear-gradient(135deg, var(--grad-a), var(--grad-b))'),
    (r'linear-gradient\(135deg,#ffa41c,#ff6200\)',       'linear-gradient(135deg,var(--grad-a),var(--grad-b))'),
    # hero title animated gradient (index)
    (r'linear-gradient\(90deg,\s*#ffc46b,\s*#ff9d1c,\s*#ff7a00,\s*#ff3d00,\s*#ff7a00,\s*#ff9d1c,\s*#ffc46b\)',
     'linear-gradient(90deg, var(--grad-a), var(--primary), var(--primary-hot), var(--primary), var(--grad-a))'),
    # announcement modal title gradient (index)
    (r'linear-gradient\(135deg,\s*#fff 0%,\s*#ff9d3d 40%,\s*#ff7a00 80%,\s*#ff3d00 100%\)',
     'linear-gradient(135deg, #fff 0%, var(--grad-a) 40%, var(--primary) 80%, var(--primary-hot) 100%)'),
    # settings header gradient
    (r'linear-gradient\(135deg,#fff 0%,#fcd34d 50%,#f59e0b 100%\)',
     'linear-gradient(135deg,#fff 0%,var(--primary-soft) 50%,var(--primary) 100%)'),
    # entry-dot border should follow page bg
    (r'border:\s*3px solid rgba\(5,\s*3,\s*2,\s*0\.9\);', 'border: 3px solid var(--bg-deep);'),
]

for fname in ('index.html', 'settings.html'):
    path = BASE + fname
    with open(path, encoding='utf-8') as f:
        html = f.read()
    pre, css, post = style_scope(html)
    print(f'--- {fname} (style block: {len(css)} chars)')
    css = apply(css, RGB_PAIRS, fname)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(pre + css + post)

# ---------- index.html JS-side theming (outside <style>) ----------
path = BASE + 'index.html'
with open(path, encoding='utf-8') as f:
    html = f.read()
old = 'linear-gradient(135deg,#fff,#ff9d3d)'
if old in html:
    html = html.replace(old, 'linear-gradient(135deg,#fff,var(--grad-a))')
    print('[index.html] JS welcome-span gradient -> var(--grad-a)')
else:
    print('!! index.html JS welcome-span gradient NOT found', file=sys.stderr)
with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

# sanity: no leftover hardcoded theme colors inside style blocks
for fname in ('index.html', 'settings.html'):
    with open(BASE + fname, encoding='utf-8') as f:
        html = f.read()
    _, css, _ = style_scope(html)
    leftovers = re.findall(r'rgba\((?:255,\s*122|255,\s*61|245,\s*158|12,\s*6|28,\s*13),', css)
    print(f'--- {fname} leftover hardcoded rgb in CSS: {leftovers or "NONE"}')

print('DONE')
