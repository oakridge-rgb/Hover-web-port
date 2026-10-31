FATE V7 — THEMES + COUNTDOWN UPDATE (upload list)
==================================================

UPLOAD THESE 6 FILES (same folder as your site root):
  index.html      — FATE V7 branding + theme engine + launch countdown
  games.html      — FATE V7 branding + theme engine + launch countdown
  settings.html   — new "Themes" picker card + V7 branding
  theme.js        — NEW: the site-wide theme engine (10 themes)
  countdown.js    — NEW: launch countdown banner (Nov 19 · 6:05 AM CT)
  a.json          — changelog with the V7.0.0 entry + launch announcement

IMPORTANT — a.json:
  If you already have an a.json on your site with older versions you
  want to keep, don't overwrite it — just copy the "V7.0.0" object
  from my a.json to the TOP of your changelog array (and the
  "announcement" object if you want the popup).

WHAT YOU GET:
  10 themes, picked in Settings > Themes:
    - Classic FATE   (original amber/orange)
    - PS3 XMB        (midnight blue)
    - Xbox 360       (blade green)
    - GameCube       (indigo purple)
    - Vaporwave      (neon pink & cyan)
    - Matrix         (digital rain green)
    - PSP            (pocket silver & wave blue)
    - Wii Menu       (channel white & Wii blue — light theme!)
    - Switch         (neon red & joy-con blue)
    - Game Boy       (DMG pea-green screen — light theme!)
  - Theme applies to the whole page: buttons, sidebar, glows, orbs,
    particles, modals, changelog, gate screen — everything.
  - Works on index.html (Home) AND games.html, exactly like you asked.
  - Saved in localStorage (fate_v7_theme), synced live across tabs.
  - Particles recolor instantly when you switch themes (canvas too —
    the games page's connected-dot particles follow the theme).

LAUNCH COUNTDOWN:
  - index.html + games.html show a banner counting down to
    Nov 19, 2026 · 6:05 AM Central (anyone in the world sees the
    same remaining time — the target is a fixed moment).
  - Days / Hrs / Min / Sec cells, styled with your theme colors.
  - After 6:05 AM on Nov 19 it automatically flips to a glowing
    "FATE V7 IS LIVE" pill. No need to touch anything on launch day.
  - Want it on other pages? Add <script src="countdown.js"></script>
    after theme.js. Different date? Set window.FATE_LAUNCH_AT before
    the script tag.

WANT THEMES ON MORE PAGES (s.html, tv.html, os.html, w.html...)?
  Add one line to that page's <head>:
    <script src="theme.js"></script>
  and (for full recoloring) move its hardcoded colors to the CSS
  variables theme.js uses: --primary, --primary-rgb, --primary-hot-rgb,
  --grad-a/--grad-b, --panel-rgb, --panel2-rgb, --bg-deep, --text,
  --text-muted, --particle-rgb. index.html / settings.html / games.html
  are done already — copy the same pattern. (Keep semantic colors like
  danger reds / panic buttons hardcoded so they stay red in every theme.)

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
    give it id/label/swatch/vars (optional: extra for small CSS
    patches) — it auto-appears in Settings.
  - Light themes (Wii Menu / Game Boy) patch their .bg-overlay and
    .page-glow through the theme's "extra" CSS automatically.
  - All pages boot their init steps guarded: if cloak.js / track.js /
    seasonal.js ever fail to load, the Themes picker still renders.
