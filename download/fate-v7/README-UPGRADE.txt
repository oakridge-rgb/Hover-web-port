FATE V7 — THEMES UPDATE (upload list)
=====================================

UPLOAD THESE 4 FILES (same folder as your site root):
  index.html      — FATE V7 branding + theme engine wired in
  settings.html   — new "Themes" picker card + V7 branding
  theme.js        — NEW: the site-wide theme engine
  a.json          — changelog with the V7.0.0 entry + launch announcement

IMPORTANT — a.json:
  If you already have an a.json on your site with older versions you
  want to keep, don't overwrite it — just copy the "V7.0.0" object
  from my a.json to the TOP of your changelog array (and the
  "announcement" object if you want the popup).

WHAT YOU GET:
  6 themes, picked in Settings > Themes:
    - Classic FATE   (original amber/orange)
    - PS3 XMB        (midnight blue)
    - Xbox 360       (blade green)
    - GameCube       (indigo purple)
    - Vaporwave      (neon pink & cyan)
    - Matrix         (digital rain green)
  - Theme applies to the whole page: buttons, sidebar, glows, orbs,
    particles, modals, changelog, gate screen — everything.
  - Works on index.html (Home) too, exactly like you asked.
  - Saved in localStorage (fate_v7_theme), synced live across tabs.
  - Particles recolor instantly when you switch themes.

WANT THEMES ON MORE PAGES (games.html, s.html, tv.html, os.html...)?
  Add one line to that page's <head>:
    <script src="theme.js"></script>
  and (for full recoloring) move its hardcoded colors to the CSS
  variables theme.js uses: --primary, --primary-rgb, --primary-hot-rgb,
  --grad-a/--grad-b, --panel-rgb, --panel2-rgb, --bg-deep, --text,
  --text-muted, --particle-rgb. index.html/settings.html are done
  already — copy the same pattern.

NEW THEME API (for custom pages / FATE OS):
  FATE_theme()                  -> current theme id
  FATE_setTheme('ps3')          -> switch + save
  FATE_themeList()              -> [{id,label,desc,swatch}]
  window.FATE_THEMES            -> full definitions (add your own!)
  document event: "fate-themechange"

NOTES:
  - Password gate unchanged (same fate_v6_auth session key, nobody
    gets logged out).
  - Changelog modal pops once per user for V7.0.0, announcement
    popup included (users can tick "don't show again").
  - To add a new theme later: copy a block in theme.js THEMES,
    give it id/label/swatch/vars — it auto-appears in Settings.
