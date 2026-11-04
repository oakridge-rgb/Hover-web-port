#!/usr/bin/env python3
"""Customize site/gn-math.html: strip gn-math branding -> FATE, remove games,
keep only the 6 requested apps, add an address bar (open any site like a browser)."""
import re

P = '/home/z/my-project/download/site/gn-math.html'
d = open(P, encoding='utf-8', errors='replace').read()

ms = re.search(r'<script[^>]*>.*?</script>', d, re.S)
shell_pre, bundle, shell_post = d[:ms.start()], ms.group(0), d[ms.end():]
n_edits = 0

# ================= BUNDLE EDITS =================
# 1) games catalog array -> empty (kills all 789/840 entries incl. their gn-math credits)
s = bundle.find('x=[{id:-1')
assert s > 0, 'games array not found'
i, depth, inb, esc = s + 2, 0, False, False
while True:
    c = bundle[i]
    if inb:
        if esc: esc = False
        elif c == '\\': esc = True
        elif c == '"': inb = False
    else:
        if c == '"': inb = True
        elif c == '[': depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0: break
    i += 1
bundle = bundle[:s] + 'x=[]' + bundle[i + 1:]
n_edits += 1

# 2) app list -> the 6 requested apps (order as user listed)
old_pe = re.search(r'pE=\[\[.*?\]\]', bundle).group(0)
new_pe = ('pE=[["movies","movies & tv","https://www.movy.sx/"],'
          '["TikTok","tiktok","https://www.tiktok.com/"],'
          '["Instagram","instagram","https://www.instagram.com/"],'
          '["books","books","https://bookracy.com/"],'
          '["YouTube","youtube","https://www.youtube.com/"],'
          '["discord","discord","https://discord.com/app"]]')
bundle = bundle.replace(old_pe, new_pe, 1)
n_edits += 1

# 3) notices branding
bundle = bundle.replace('gn-math portable fork', 'FATE portal', 1)
n_edits += 1
assert 'gn-math' not in bundle, 'leftover gn-math in bundle'

# ================= SHELL EDITS =================
# 4) title + wordmark
shell_pre = shell_pre.replace('<title>gn-math</title>', '<title>FATE</title>', 1)
shell_pre = re.sub(r'(<a class="wordmark" href="#">)[^<]*(</a>)', r'\g<1>FATE\g<2>', shell_pre, count=1)
n_edits += 2

# 5) favicon -> FATE "F" badge
FAV = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
       "%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E"
       "%3Cstop offset='0' stop-color='%23f59e0b'/%3E%3Cstop offset='1' stop-color='%23ef4444'/%3E"
       "%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='url(%23g)'/%3E"
       "%3Ctext x='32' y='45' font-family='Arial,Helvetica,sans-serif' font-size='38' font-weight='800' "
       "fill='%23fff' text-anchor='middle'%3EF%3C/text%3E%3C/svg%3E")
shell_pre, n_fav = re.subn(r'<link rel="icon" href="data:image/png;base64,[^"]*"',
                           f'<link rel="icon" href="{FAV}"', shell_pre, count=1)
n_edits += n_fav

# 6) app grid: 10 columns -> 6
shell_pre = shell_pre.replace('.app-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:18px}',
                              '.app-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px}', 1)
n_edits += 1

# 7) hard-hide games section & player
kill = '[aria-labelledby="games-title"],#player{display:none!important}'
shell_pre = shell_pre.replace('</style>', kill + '</style>', 1)
n_edits += 1

# 8) settings wording
shell_pre = shell_pre.replace('checking where games load from...', 'checking connection route...', 1)
shell_pre = shell_pre.replace('apps and games need internet. your settings stay in this browser.',
                              'apps need internet. your settings stay in this browser.', 1)
n_edits += 2

# 9) address bar (open any site like a browser) inside the apps section
BAR = '''<form id="openbar" autocomplete="off">
          <input id="openurl" type="text" inputmode="url" placeholder="open any website — youtube.com, tiktok.com…" aria-label="website address">
          <button type="submit">open</button>
        </form>'''
anchor = '<div id="apps" class="app-grid"></div>'
assert anchor in shell_pre
shell_pre = shell_pre.replace(anchor, BAR + anchor, 1)
# bar styling (uses the app's own accent variable)
barcss = ('#openbar{display:flex;gap:10px;margin:0 0 26px}'
          '#openurl{flex:1;padding:14px 18px;background:rgba(255,255,255,.04);'
          'border:1px solid rgba(255,255,255,.12);border-radius:12px;color:inherit;'
          'font-size:14px;outline:none;font-family:inherit;min-width:0}'
          '#openurl:focus{border-color:var(--accent)}'
          '#openbar button{padding:14px 24px;border-radius:12px;border:0;background:var(--accent);'
          'color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}'
          '@media(max-width:640px){#openbar{flex-direction:column}}')
shell_pre = shell_pre.replace('</style>', barcss + '</style>', 1)
n_edits += 2
# bar behavior: set #open= and reload -> the engine opens it through the proxy
BARJS = '''<script>
(function(){
  var f=document.getElementById('openbar');
  f&&f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=document.getElementById('openurl').value.trim();
    if(!v)return;
    if(!/^https?:\\/\\//i.test(v))v='https://'+v;
    try{new URL(v)}catch(err){return}
    location.hash='open='+encodeURIComponent(v);
    location.reload();
  });
})();
</script>'''
shell_post = shell_post.replace('</body>', BARJS + '</body>', 1)
n_edits += 1

out = shell_pre + bundle + shell_post
open(P, 'w', encoding='utf-8').write(out)
print(f'done: {n_edits} edits applied, {len(out):,} chars')
print('games entries left:', out.count('{id:'))
print('pE now:', re.search(r'pE=\[\[.*?\]\]', out).group(0)[:120], '...')
print('shell gn-math left:', (shell_pre + shell_post).count('gn-math'))
