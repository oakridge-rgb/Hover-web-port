#!/usr/bin/env python3
"""Build the FATE V6 site integration: apps.html + gn-math.html + patched navs."""
import json, os, re, shutil

UP = '/home/z/my-project/upload'
DL = '/home/z/my-project/download'
SITE = f'{DL}/site'
os.makedirs(SITE, exist_ok=True)

icons = json.load(open('/home/z/my-project/scripts/icons.json'))

# ---------- 1) copy engine (never overwrite a customized engine) ----------
if not os.path.exists(f'{SITE}/gn-math.html'):
    shutil.copy2(f'{DL}/gn-math.html', f'{SITE}/gn-math.html')
    print('copied gn-math.html')
else:
    print('kept existing gn-math.html (already customized)')

# ---------- 2) apps.html ----------
APPS = [
    ("movies",    "Movies & TV", "Free movies & shows, full streaming site", "https://www.movy.sx/",                 "movies"),
    ("TikTok",    "TikTok",      "The real For You feed, works in-browser",  "https://www.tiktok.com/",              "TikTok"),
    ("Instagram", "Instagram",   "Browse feeds & reels",                     "https://www.instagram.com/",           "Instagram"),
    ("books",     "Books",       "Huge free library, read in-browser",       "https://bookracy.com/",                "books"),
    ("YouTube",   "YouTube",     "Real YouTube — search, watch, everything", "https://www.youtube.com/",             "YouTube"),
    ("discord",   "Discord",     "Full web app — log in and chat",           "https://discord.com/app",              "discord"),
]
tiles = "\n".join(
    f'''      <button class="app-tile" data-app="{key}" data-url="{url}" data-label="{label}">
        <span class="tile-icon">{icons[icon]}</span>
        <span class="tile-name">{label}</span>
        <span class="tile-desc">{desc}</span>
      </button>'''
    for key, label, desc, url, icon in APPS
)

APPS_JSON = json.dumps([{'key': k, 'label': l, 'url': u} for k, l, _, u, _ in APPS])

apps_html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FATE V6 — Apps</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{{--primary:#f59e0b;--secondary:#ef4444;--bg-deep:#050505;--bg2:#0a0a0c;--glass-border:rgba(255,255,255,.1);--text:#f8fafc;--text-muted:#cbd5e1;--card:rgba(255,255,255,.03)}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{height:100%}}
body{{background:var(--bg-deep);color:var(--text);font-family:'Inter',sans-serif;overflow-x:hidden}}
body::before{{content:'';position:fixed;inset:0;background:
 radial-gradient(900px 500px at 15% -10%,rgba(245,158,11,.12),transparent 60%),
 radial-gradient(800px 500px at 90% 0%,rgba(239,68,68,.10),transparent 60%),var(--bg-deep);z-index:-1}}
a{{color:inherit;text-decoration:none}}
/* ---------- nav (matches FATE V6 glass nav) ---------- */
.nav-glass{{position:sticky;top:0;z-index:50;background:rgba(5,5,5,.72);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-bottom:1px solid var(--glass-border);padding:14px 24px}}
.nav-inner{{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:14px}}
.nav-brand{{display:flex;align-items:center;gap:12px}}
.nav-logo{{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(245,158,11,.4)}}
.nav-logo span{{font-weight:800;font-size:18px;color:#fff;font-family:'Space Grotesk',sans-serif}}
.nav-title{{font-size:1.15rem;font-weight:700;background:linear-gradient(135deg,#fff,#fcd34d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}}
.nav-right{{margin-left:auto;display:flex;align-items:center;gap:8px}}
.nav-home{{padding:10px 16px;border-radius:12px;font-weight:600;font-size:.85rem;color:var(--text-muted);background:rgba(255,255,255,.03);border:1px solid var(--glass-border);cursor:pointer;transition:all .3s;font-family:inherit}}
.nav-home:hover{{color:#fff;border-color:rgba(245,158,11,.4)}}
/* ---------- hero ---------- */
.hero{{max-width:1200px;margin:0 auto;padding:52px 24px 18px}}
.hero h1{{font-family:'Space Grotesk',sans-serif;font-size:clamp(1.9rem,4.5vw,2.9rem);font-weight:800;letter-spacing:-.02em}}
.hero h1 em{{font-style:normal;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}}
.hero p{{margin-top:10px;color:var(--text-muted);font-size:.98rem;max-width:640px;line-height:1.6}}
/* ---------- grid ---------- */
.grid{{max-width:1200px;margin:26px auto 0;padding:0 24px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}}
.app-tile{{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:20px 18px;background:var(--card);border:1px solid var(--glass-border);border-radius:18px;cursor:pointer;text-align:left;font-family:inherit;color:var(--text);transition:all .25s;min-height:148px}}
.app-tile:hover{{transform:translateY(-3px);border-color:rgba(245,158,11,.45);background:rgba(245,158,11,.06);box-shadow:0 14px 40px rgba(0,0,0,.5)}}
.app-tile:active{{transform:translateY(-1px)}}
.tile-icon{{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid var(--glass-border);font-size:24px;color:var(--primary)}}
.tile-icon svg{{width:24px;height:24px}}
.tile-name{{font-weight:700;font-size:1.02rem;font-family:'Space Grotesk',sans-serif}}
.tile-desc{{color:var(--text-muted);font-size:.8rem;line-height:1.45}}
/* ---------- deck card ---------- */
.deck{{max-width:1200px;margin:18px auto 0;padding:0 24px}}
.deck-btn{{width:100%;display:flex;align-items:center;gap:16px;padding:20px 22px;border-radius:18px;border:1px solid rgba(245,158,11,.35);background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(239,68,68,.10));cursor:pointer;color:var(--text);font-family:inherit;transition:all .25s;text-align:left}}
.deck-btn:hover{{transform:translateY(-2px);box-shadow:0 16px 44px rgba(245,158,11,.15)}}
.deck-btn .big{{font-weight:800;font-size:1.05rem;font-family:'Space Grotesk',sans-serif}}
.deck-btn .sub{{color:var(--text-muted);font-size:.82rem;margin-top:3px}}
.deck-btn .arrow{{margin-left:auto;font-size:1.3rem;color:var(--primary)}}
.foot{{max-width:1200px;margin:26px auto 0;padding:0 24px 40px;color:#64748b;font-size:.75rem;line-height:1.6}}
/* ---------- fullscreen app overlay ---------- */
.overlay{{position:fixed;inset:0;z-index:100;display:none;background:var(--bg-deep)}}
.overlay.open{{display:flex;flex-direction:column}}
.ov-bar{{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(10,10,12,.92);border-bottom:1px solid var(--glass-border);flex-shrink:0}}
.ov-btn{{padding:9px 14px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid var(--glass-border);color:var(--text);font-family:inherit;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .25s}}
.ov-btn:hover{{border-color:rgba(245,158,11,.45)}}
.ov-title{{font-weight:700;font-size:.92rem;font-family:'Space Grotesk',sans-serif;color:#fcd34d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
.ov-status{{margin-left:auto;color:#64748b;font-size:.75rem}}
.ov-frame-wrap{{flex:1;position:relative}}
#ovFrame{{position:absolute;inset:0;width:100%;height:100%;border:none;background:#050505}}
.ov-spin{{position:absolute;inset:0;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;color:var(--text-muted);font-size:.9rem}}
.ov-spin .ring{{width:42px;height:42px;border-radius:50%;border:3px solid rgba(245,158,11,.2);border-top-color:var(--primary);animation:spin 1s linear infinite}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
@media(max-width:640px){{.grid{{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}}.app-tile{{min-height:128px;padding:16px}}.hero{{padding:34px 18px 10px}}.grid{{padding:0 18px}}.deck{{padding:0 18px}}}}
</style>
</head>
<body>

<nav class="nav-glass">
  <div class="nav-inner">
    <a class="nav-brand" href="index.html">
      <div class="nav-logo"><span>F</span></div>
      <span class="nav-title">FATE Apps</span>
    </a>
    <div class="nav-right">
      <button class="nav-home" onclick="location.href='index.html'">Home</button>
    </div>
  </div>
</nav>

<section class="hero">
  <h1>Apps <em>— all in one place</em></h1>
  <p>Movies, TikTok, YouTube, Books and more — streamed straight through the built-in private proxy.
     First launch takes a few seconds while it connects; after that it's cached and fast.</p>
</section>

<section class="grid" id="appGrid">
{tiles}
</section>

<section class="deck">
  <button class="deck-btn" onclick="location.href='gn-math.html'">
    <span class="tile-icon">{icons['browser']}</span>
    <span>
      <span class="big">Open the app launcher</span>
      <span class="sub" style="display:block">Everything above in one place — plus a built-in address bar to open ANY site through the proxy</span>
    </span>
    <span class="arrow">→</span>
  </button>
</section>

<div class="foot">
  Apps load through public Wisp relays (arctic.lat · mercurywork.shop · anura.pro). If one is down, the app automatically
  retries the next relay — press Reload in the top bar if a site ever stalls. Tip: Ctrl+click any tile to open it in a new tab.
</div>

<div class="overlay" id="overlay">
  <div class="ov-bar">
    <button class="ov-btn" onclick="closeApp()">← Back</button>
    <span class="ov-title" id="ovTitle">app</span>
    <button class="ov-btn" onclick="reloadApp()">↻ Reload</button>
    <button class="ov-btn" onclick="popOut()">↗ New tab</button>
    <span class="ov-status" id="ovStatus">connecting…</span>
  </div>
  <div class="ov-frame-wrap">
    <div class="ov-spin" id="ovSpin"><div class="ring"></div><span id="ovSpinTxt">connecting to relay…</span></div>
    <iframe id="ovFrame" title="app" allow="fullscreen; clipboard-read; clipboard-write; autoplay; encrypted-media"></iframe>
  </div>
</div>

<script>
var APPS = {APPS_JSON};
var overlay = document.getElementById('overlay'),
    frame = document.getElementById('ovFrame'),
    title = document.getElementById('ovTitle'),
    spin = document.getElementById('ovSpin'),
    spinTxt = document.getElementById('ovSpinTxt'),
    statusEl = document.getElementById('ovStatus'),
    current = null;

function openApp(app, newTab) {{
  var src = 'gn-math.html#open=' + encodeURIComponent(app.url);
  if (newTab) {{ window.open(src, '_blank'); return; }}
  current = app;
  title.textContent = app.label;
  frame.src = src;
  spinTxt.textContent = 'connecting to relay…';
  statusEl.textContent = 'connecting…';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  spin.style.display = 'flex';
}}
function appReady() {{
  spin.style.display = 'none';
  statusEl.textContent = 'connected';
}}
function closeApp() {{
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  frame.src = 'about:blank';
  current = null;
}}
function reloadApp() {{
  if (!current) return;
  spin.style.display = 'flex';
  statusEl.textContent = 'connecting…';
  try {{ frame.contentWindow.location.href = 'gn-math.html#open=' + encodeURIComponent(current.url) + '&r=' + Date.now(); }}
  catch (err) {{ frame.src = 'gn-math.html#open=' + encodeURIComponent(current.url); }}
}}
function popOut() {{
  if (!current) return;
  window.open('gn-math.html#open=' + encodeURIComponent(current.url), '_blank');
}}
frame.addEventListener('load', function() {{
  var s = frame.src || '';
  if (s && s !== 'about:blank' && s.indexOf('data:') !== 0) appReady();
}});
document.getElementById('appGrid').addEventListener('click', function(e) {{
  var t = e.target.closest('.app-tile');
  if (t) {{
    var app = APPS.filter(function(a) {{ return a.key === t.dataset.app; }})[0];
    if (app) openApp(app, e.ctrlKey || e.metaKey);
  }}
}});
document.addEventListener('keydown', function(e) {{
  if (e.key === 'Escape' && overlay.classList.contains('open')) closeApp();
}});
</script>
</body>
</html>
'''
open(f'{SITE}/apps.html', 'w', encoding='utf-8').write(apps_html)
print('wrote apps.html', len(apps_html), 'chars')

# ---------- 3) patch existing pages: add Apps tab after <div class="nav-tabs"> ----------
BTN = '<button class="nav-tab" onclick="location.href=\'apps.html\'">Apps</button>'
for page in ['tv.html', 's.html']:
    d = open(f'{UP}/{page}', encoding='utf-8', errors='replace').read()
    if "apps.html" in d:
        print(page, 'already patched'); continue
    marker = '<div class="nav-tabs">'
    i = d.find(marker)
    if i >= 0:
        j = i + len(marker)
        d2 = d[:j] + '\n      ' + BTN + d[j:]
        open(f'{SITE}/{page}', 'w', encoding='utf-8').write(d2)
        print('patched', page, '(+Apps tab)')
    else:
        print(page, 'no nav-tabs found — skipped')

# ---------- 3b) index.html (from fate-portal-v2) + Apps/Browser in every fab-menu ----------
FAB_ITEMS = '''<a href="apps.html" class="fab-item">
      <svg viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
      <span>Apps</span>
    </a>
    <a href="gn-math.html" class="fab-item">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      <span>Browser</span>
    </a>
    '''

def add_fab_items(d):
    """Insert Apps+Browser right after the Home item of the fab menu."""
    if 'href="apps.html" class="fab-item"' in d:
        return d, 'already'
    m = re.search(r'<a href="index\.html" class="fab-item">', d)
    if not m:
        return d, 'no-home-item'
    j = d.find('</a>', m.end())
    if j < 0:
        return d, 'no-home-close'
    j += len('</a>')
    return d[:j] + '\n    ' + FAB_ITEMS.rstrip() + d[j:], 'patched'

# index = the portal hub
d = open(f'{DL}/fate-portal-v2.html', encoding='utf-8', errors='replace').read()
d, st = add_fab_items(d)
open(f'{SITE}/index.html', 'w', encoding='utf-8').write(d)
print('index.html:', st, '(built from fate-portal-v2.html)')

# same two links on the other pages' fab menus
for page in ['tv.html', 's.html', 'games.html', 'w.html', 'settings.html']:
    src = f'{SITE}/{page}' if os.path.exists(f'{SITE}/{page}') else f'{UP}/{page}'
    d = open(src, encoding='utf-8', errors='replace').read()
    d, st = add_fab_items(d)
    if st == 'patched':
        open(f'{SITE}/{page}', 'w', encoding='utf-8').write(d)
    print(page, 'fab-menu:', st)

# ---------- 4) DEPLOY notes ----------
open(f'{SITE}/DEPLOY.txt', 'w').write('''FATE V6 — APPS SECTION (customized gn-math engine)
===================================================
WHAT CHANGED (engine rebrand)
  gn-math.html is now "FATE": branding, title, favicon and accent color all
  switched to FATE amber. Games completely removed. Only 6 apps:
  Movies & TV (movy.sx) / TikTok / Instagram / Books / YouTube / Discord.
  NEW: built-in address bar — type any site and it opens through the proxy
  (works like a browser). Deep links still work:
    gn-math.html#open=https%3A%2F%2Fwww.movy.sx%2F

NEW FILES
  apps.html      the Apps page (6 app tiles + launcher button)
  gn-math.html   the app engine (~16.7 MB, self-contained — keep this exact
                 file name next to apps.html, or update the links)

PATCHED FILES (fab-menu now has: Home, Apps, Browser, then your links)
  index.html      your hub (fate-portal-v2) with Apps + Browser added
  tv.html, s.html -> +Apps tab in the nav row + Apps/Browser in fab menu
  games.html, w.html, settings.html -> Apps/Browser in fab menu

NOTES
  - Tested end-to-end: Movies (movy.sx), TikTok feed, and YouTube via the
    address bar all load through the built-in Wisp relays — no server
    config needed on your side.
  - Serve over HTTPS (or localhost) so the WebSocket relays are never blocked.
  - The engine is cached by the browser after the first load.
  - Relays auto-fall-over: arctic.lat -> wisp.mercurywork.shop ->
    api.ixl.college -> api.sngdu.com -> anura.pro. Press Reload if a site stalls.
''')
print('wrote DEPLOY.txt')
print('\nSITE FOLDER:')
for f in sorted(os.listdir(SITE)):
    print(f'  {f:22s} {os.path.getsize(f"{SITE}/{f}"):>10,d} bytes')
