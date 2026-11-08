#!/usr/bin/env python3
"""Add wisp-verified movie sites to site/apps.html as grouped tiles (Nov 8 2026 test)."""
import re, json, pathlib

APPS = pathlib.Path('/home/z/my-project/download/site/apps.html')
h = APPS.read_text()

FILM = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m12.296 3.464l3.02 3.956M20.2 6L3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3zM3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm3.18-5.724l3.1 3.899"/></svg>'
TV = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm4-6l5 4l5-4M9 17l2-3m2 0l2 3"/></svg>'
HUB = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg>'

MOVIES = [
    ("Aether",     "https://aether.st/",            "P-Stream player - 4K, no ads, auto-next"),
    ("Cinejoy",    "https://cinejoy.pk/",           "Clean catalog, auto-next episodes"),
    ("7Movies",    "https://7movies.ac/",           "Movies & TV in HD, big catalog"),
    ("Atlantic",   "https://atlantic.bz/",          "4K aggregator, smooth player"),
    ("Vivarium",   "https://vivarium.su/",          "Fast embeds, auto-next"),
    ("CineLite",   "https://cinelite.xyz/",         "Lightweight 4K player"),
    ("Ghostflix",  "https://ghostflix.st/",         "HD movies & what to watch"),
    ("MeowTV",     "https://meowtv.ru/",            "Movies, TV shows & anime"),
    ("Reelix",     "https://reelix.ac/",            "HD streaming, auto-next"),
    ("Cno",        "https://cno.to/",               "Dedicated-server player, 4K"),
    ("SweetFox",   "https://sweetfox.app/",         "Simple and quick, auto-next"),
    ("Cinecat",    "https://cinecat.eu/",           "P-Stream fork, 4K"),
    ("Flixer",     "https://flixer.gd/",            "Free streaming hub"),
    ("Dulo",       "https://dulo.mov/",             "4K, auto-next"),
    ("Basement",   "https://basementx.lol/",        "P-Stream fork, 4K"),
    ("ShuttleTV",  "https://shuttletv.su/",         "Multi-mirror player"),
    ("TonkaCine",  "https://tonkacine.watch/",      "Movies & TV series"),
    ("Moovie",     "https://moovie.fun/",           "Movies, TV & anime"),
    ("Cineby",     "https://cinebytv.com/",         "No ads, no login"),
    ("PrimeShows", "https://primeshows.org/",       "Big multi-server catalog"),
    ("PressPlayZ", "https://pressplayz.top/",       "No sign-up streaming"),
    ("LookMovie",  "https://www.lookmovie2.to/",    "Classic movie aggregator"),
    ("Goojara",    "https://ww1.goojara.to/",       "Movies, series & anime"),
    ("Levidia",    "https://www.levidia.ch/",       "Huge movie & TV library"),
    ("1Shows",     "https://www.1shows.org/",       "Multi-server player"),
    ("ArrowTV",    "https://arrowtv.net/",          "Slick TV & movie player"),
    ("AniCine",    "https://anicine.sbs/",          "Movies, TV & anime in HD"),
]
TOONS = [
    ("MegaCartoons", "https://www.megacartoons.net/",   "Classic & new cartoons"),
    ("SuperCartoons","https://www.supercartoons.net/",  "Old-school cartoon vault"),
    ("HiAnime",      "https://hianimes.ru/",            "Anime, sub & dub, HD"),
]
HUBS = [
    ("Aetheris", "https://aetheris.win/",       "Games, movies, proxy & chat in one"),
    ("Moxy",     "https://moxy.neocities.org/", "The Moxy Files - 90s cartoon & show archive"),
]

def key(label):
    return 'ms-' + re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')

all_sites = []
def mk(label, url, desc, icon, grid):
    all_sites.append({"key": key(label), "label": label, "url": url, "grid": grid})
    return ('<button class="app-tile" data-app="%s">'
            '<span class="tile-icon">%s</span>'
            '<span class="tile-name">%s</span>'
            '<span class="tile-desc">%s</span>'
            '<span class="tile-host">%s</span></button>') % (key(label), icon, label, desc, re.sub(r'^https?://(www\.)?|/$', '', url))

section = '''<section class="sh" id="msites">
  <h2>Movie sites <em>— verified on the wisp proxy</em></h2>
  <p class="sh-sub">Every site below was opened through the built-in proxy lanes and returned a real page on Nov 8 2026.
     Tap one to stream it inside FATE — first connect takes a few seconds.</p>
</section>
<section class="grid" id="movieGrid"></section>
<section class="sh">
  <h2>Cartoons &amp; anime <em>— verified</em></h2>
</section>
<section class="grid" id="toonGrid"></section>
<section class="sh">
  <h2>Hubs <em>— all-in-one sites</em></h2>
</section>
<section class="grid" id="hubGrid"></section>
'''

# 1) insert sections before the deck
assert '<section class="deck">' in h
h = h.replace('<section class="deck">', section + '\n<section class="deck">', 1)

# 2) CSS for section headers + tile-host
h = h.replace("/* ---------- deck card ---------- */",
""".sh{max-width:1200px;margin:36px auto 0;padding:0 24px}
.sh h2{font-family:'Space Grotesk',sans-serif;font-size:1.3rem;font-weight:800;letter-spacing:-.01em}
.sh h2 em{font-style:normal;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.sh-sub{color:var(--text-muted);font-size:.82rem;margin-top:6px;line-height:1.55;max-width:720px}
.tile-host{font-size:.68rem;color:#64748b;font-family:'Space Grotesk',monospace;letter-spacing:.02em}
/* ---------- deck card ---------- */""", 1)

# 3) MSITES data + render + global click delegation
js_block = '''var MSITES = %s;
APPS = APPS.concat(MSITES.map(function (m) { return { key: m.key, label: m.label, url: m.url }; }));
(function renderMovieSites() {
  var ICON = "__ICON__";
  var targets = { movieGrid: document.getElementById('movieGrid'), toonGrid: document.getElementById('toonGrid'), hubGrid: document.getElementById('hubGrid') };
  MSITES.forEach(function (m) {
    var g = targets[m.grid];
    if (!g) return;
    var b = document.createElement('button');
    b.className = 'app-tile';
    b.setAttribute('data-app', m.key);
    b.innerHTML = '<span class="tile-icon">' + ICON + '</span><span class="tile-name">' + m.label + '</span><span class="tile-desc">' + m.desc + '</span><span class="tile-host">' + m.host + '</span>';
    g.appendChild(b);
  });
})();''' % json.dumps([{ "key": key(l), "label": l, "url": u, "desc": d, "host": re.sub(r'^https?://(www\\.)?|/$', '', u), "grid": g } for (l, u, d, g) in [(l, u, d, 'movieGrid') for (l, u, d) in MOVIES] + [(l, u, d, 'toonGrid') for (l, u, d) in TOONS] + [(l, u, d, 'hubGrid') for (l, u, d) in HUBS]])

js_block = js_block.replace('"__ICON__"', json.dumps(FILM), 1)
h = h.replace("var overlay = document.getElementById('overlay'),",
              js_block + "\nvar overlay = document.getElementById('overlay'),", 1)

# 4) document-level click delegation instead of appGrid-only
old_click = """document.getElementById('appGrid').addEventListener('click', function(e) {
  var t = e.target.closest('.app-tile');
  if (t) {
    var app = APPS.filter(function(a) { return a.key === t.dataset.app; })[0];
    if (app) openApp(app, e.ctrlKey || e.metaKey);
  }
});"""
new_click = """document.addEventListener('click', function(e) {
  var t = e.target.closest('.app-tile');
  if (t && t.dataset.app) {
    var app = APPS.filter(function(a) { return a.key === t.dataset.app; })[0];
    if (app) openApp(app, e.ctrlKey || e.metaKey);
  }
});"""
assert old_click in h
h = h.replace(old_click, new_click, 1)

# 5) foot note
h = h.replace("Tip: Ctrl+click any tile to open it in a new tab.",
              "Tip: Ctrl+click any tile to open it in a new tab. Movie sites re-verified through the wisp lanes on Nov 8 2026 (full report: MOVIE-SITES.txt).", 1)

APPS.write_text(h)
print("apps.html updated:", len(h), "bytes,", len(all_sites), "movie tiles")
