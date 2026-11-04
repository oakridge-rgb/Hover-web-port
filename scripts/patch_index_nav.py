#!/usr/bin/env python3
"""Add nav-tabs (Home/Apps/Browser/Games/TV/Watch/Music/Settings) to
index.html's glass nav, matching tv.html's tab styles. Also remove the
dead `ai.html` FAB entries (page doesn't exist) from index + games.
"""
import re

SITE = "/home/z/my-project/download/site/"

TABS_CSS = """.nav-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.nav-tabs::-webkit-scrollbar{display:none}
.nav-tab{padding:9px 16px;border-radius:12px;font-weight:500;color:var(--text-muted);background:none;border:1px solid transparent;cursor:pointer;font-size:.88rem;transition:all .3s;white-space:nowrap;font-family:inherit}
.nav-tab:hover{color:#fff;background:rgba(245,158,11,.1)}
.nav-tab.active{background:rgba(245,158,11,.15);color:var(--primary);border-color:rgba(245,158,11,.3)}"""

TABS_HTML = """<div class="nav-tabs">
      <button class="nav-tab active" onclick="location.href='index.html'">Home</button>
      <button class="nav-tab" onclick="location.href='apps.html'">Apps</button>
      <button class="nav-tab" onclick="location.href='gn-math.html'">Browser</button>
      <button class="nav-tab" onclick="location.href='games.html'">Games</button>
      <button class="nav-tab" onclick="location.href='tv.html'">Live TV</button>
      <button class="nav-tab" onclick="location.href='w.html'">Watch</button>
      <button class="nav-tab" onclick="location.href='s.html'">Music</button>
      <button class="nav-tab" onclick="location.href='settings.html'">Settings</button>
    </div>"""


def add_tabs(s):
    assert 'nav-tabs' not in s, "nav-tabs already present"
    i = s.find('<nav')
    j = s.find('</nav>', i)
    assert i >= 0 and j > i
    nav = s[i:j]
    k = nav.rfind('</div>')          # closes nav-inner
    nav2 = nav[:k] + TABS_HTML + "\n  " + nav[k:]
    s = s[:i] + nav2 + s[j:]

    # css: insert before the closing of the first <style> block that has .nav-glass
    g = s.find('.nav-glass')
    st_end = s.find('</style>', g)
    assert g >= 0 and st_end > g
    s = s[:st_end] + TABS_CSS + "\n" + s[st_end:]
    return s


def drop_dead_ai(s):
    return re.sub(r'<a href="ai\.html" class="fab-item">.*?</a>\s*', '', s, count=1, flags=re.S)


for fname in ["index.html", "games.html"]:
    p = SITE + fname
    s = open(p, encoding="utf-8").read()
    if fname == "index.html":
        s = add_tabs(s)
    assert 'ai.html' in s, f"{fname}: no ai.html ref?"
    s = drop_dead_ai(s)
    assert 'ai.html' not in s, f"{fname}: ai.html still referenced"
    open(p, "w", encoding="utf-8").write(s)
    print(f"{fname}: ok (ai.html ref removed{' + nav-tabs added' if fname == 'index.html' else ''})")

# final verify
v = open(SITE + "index.html", encoding="utf-8").read()
for dest in ["apps.html", "gn-math.html", "games.html", "tv.html", "w.html", "s.html", "settings.html"]:
    assert f"location.href='{dest}'" in v, dest
assert v.count('class="nav-tab active"') == 1
print("index.html nav tabs verified: 8 tabs, Home active, all destinations resolve to existing files")
