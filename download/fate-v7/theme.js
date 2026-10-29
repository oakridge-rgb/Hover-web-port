/* ================================================================
   FATE V7 — THEME ENGINE
   Site-wide theming. Pick a theme in Settings -> Themes and it
   applies everywhere theme.js is loaded (Home, Settings, etc).

   How it works:
   - Pages describe their colors with CSS variables (--primary,
     --grad-a, --panel-rgb, ...). This engine overrides those vars
     per theme via html[data-fate-theme="id"].
   - Current theme is saved in localStorage "fate_v7_theme" and
     synced across open tabs.
   - Pages can listen for the "fate-themechange" event to repaint
     canvas stuff (particles) with the new theme colors.

   Add to any page:  <script src="theme.js"></script>
   API: FATE_theme() / FATE_setTheme('ps3') / FATE_themeList()
   ================================================================ */
(function () {
  var KEY = 'fate_v7_theme';

  var THEMES = {
    classic: {
      label: 'Classic FATE',
      desc: 'The original amber & ember',
      swatch: ['#ff9d1c', '#ff3d00'],
      vars: {}
    },
    ps3: {
      label: 'PS3 XMB',
      desc: 'PlayStation 3 midnight blue',
      swatch: ['#6fb9ff', '#0a3d7a'],
      vars: {
        '--primary': '#4da6ff',
        '--primary-soft': '#8ec9ff',
        '--primary-hot': '#0068d7',
        '--primary-rgb': '77, 166, 255',
        '--primary-soft-rgb': '142, 201, 255',
        '--primary-hot-rgb': '0, 104, 215',
        '--primary-glow': 'rgba(77, 166, 255, 0.45)',
        '--secondary': '#00b4e6',
        '--secondary-rgb': '0, 180, 230',
        '--grad-a': '#6fb9ff',
        '--grad-b': '#0a63c9',
        '--bg-deep': '#04060a',
        '--panel-rgb': '10, 16, 26',
        '--panel2-rgb': '5, 8, 14',
        '--glass-border': 'rgba(140, 190, 255, 0.14)',
        '--card-bg': 'rgba(120, 170, 255, 0.04)',
        '--text': '#eef4fb',
        '--text-muted': '#9fb2c8',
        '--particle-rgb': '140, 190, 255',
        '--particle-glow-rgb': '90, 160, 255'
      }
    },
    xbox: {
      label: 'Xbox 360',
      desc: 'Blade green, dashboard vibes',
      swatch: ['#a8e05a', '#2e5c10'],
      vars: {
        '--primary': '#92c83e',
        '--primary-soft': '#c6f09b',
        '--primary-hot': '#4e8f1f',
        '--primary-rgb': '146, 200, 62',
        '--primary-soft-rgb': '198, 240, 155',
        '--primary-hot-rgb': '78, 143, 31',
        '--primary-glow': 'rgba(146, 200, 62, 0.45)',
        '--secondary': '#f9a825',
        '--secondary-rgb': '249, 168, 37',
        '--grad-a': '#a8e05a',
        '--grad-b': '#5a9e24',
        '--bg-deep': '#050704',
        '--panel-rgb': '12, 18, 8',
        '--panel2-rgb': '6, 9, 4',
        '--glass-border': 'rgba(170, 230, 110, 0.14)',
        '--card-bg': 'rgba(150, 220, 80, 0.04)',
        '--text': '#f1f7ea',
        '--text-muted': '#aebfa0',
        '--particle-rgb': '150, 220, 90',
        '--particle-glow-rgb': '110, 190, 60'
      }
    },
    cube: {
      label: 'GameCube',
      desc: 'Indigo & purple splash',
      swatch: ['#a99bff', '#31246e'],
      vars: {
        '--primary': '#8f7bff',
        '--primary-soft': '#c3b8ff',
        '--primary-hot': '#5a45d6',
        '--primary-rgb': '143, 123, 255',
        '--primary-soft-rgb': '195, 184, 255',
        '--primary-hot-rgb': '90, 69, 214',
        '--primary-glow': 'rgba(143, 123, 255, 0.45)',
        '--secondary': '#b84dff',
        '--secondary-rgb': '184, 77, 255',
        '--grad-a': '#a99bff',
        '--grad-b': '#6a52e8',
        '--bg-deep': '#070510',
        '--panel-rgb': '18, 14, 36',
        '--panel2-rgb': '9, 7, 20',
        '--glass-border': 'rgba(180, 160, 255, 0.15)',
        '--card-bg': 'rgba(150, 130, 255, 0.05)',
        '--text': '#f2effc',
        '--text-muted': '#b3aacb',
        '--particle-rgb': '170, 150, 255',
        '--particle-glow-rgb': '140, 110, 255'
      }
    },
    vapor: {
      label: 'Vaporwave',
      desc: 'Neon pink & cyan dreams',
      swatch: ['#ff8ad8', '#7b2ff7'],
      vars: {
        '--primary': '#ff71ce',
        '--primary-soft': '#ffa8e2',
        '--primary-hot': '#b967ff',
        '--primary-rgb': '255, 113, 206',
        '--primary-soft-rgb': '255, 168, 226',
        '--primary-hot-rgb': '185, 103, 255',
        '--primary-glow': 'rgba(255, 113, 206, 0.45)',
        '--secondary': '#01cdfe',
        '--secondary-rgb': '1, 205, 254',
        '--grad-a': '#ff8ad8',
        '--grad-b': '#c724b1',
        '--bg-deep': '#0d0518',
        '--panel-rgb': '30, 12, 44',
        '--panel2-rgb': '16, 7, 26',
        '--glass-border': 'rgba(255, 150, 220, 0.15)',
        '--card-bg': 'rgba(255, 113, 206, 0.05)',
        '--text': '#fbeeff',
        '--text-muted': '#c9a9d6',
        '--particle-rgb': '255, 140, 220',
        '--particle-glow-rgb': '1, 205, 254'
      }
    },
    matrix: {
      label: 'Matrix',
      desc: 'Digital rain green',
      swatch: ['#4dff77', '#023d10'],
      vars: {
        '--primary': '#00ff41',
        '--primary-soft': '#7dff9e',
        '--primary-hot': '#00a82a',
        '--primary-rgb': '0, 255, 65',
        '--primary-soft-rgb': '125, 255, 158',
        '--primary-hot-rgb': '0, 168, 42',
        '--primary-glow': 'rgba(0, 255, 65, 0.4)',
        '--secondary': '#00e5a8',
        '--secondary-rgb': '0, 229, 168',
        '--grad-a': '#4dff77',
        '--grad-b': '#00a82a',
        '--bg-deep': '#020602',
        '--panel-rgb': '6, 16, 8',
        '--panel2-rgb': '2, 8, 3',
        '--glass-border': 'rgba(0, 255, 65, 0.16)',
        '--card-bg': 'rgba(0, 255, 65, 0.04)',
        '--text': '#dcffe6',
        '--text-muted': '#86b391',
        '--particle-rgb': '0, 255, 80',
        '--particle-glow-rgb': '0, 200, 60'
      }
    }
  };

  function list() {
    return Object.keys(THEMES).map(function (id) {
      return { id: id, label: THEMES[id].label, desc: THEMES[id].desc, swatch: THEMES[id].swatch };
    });
  }

  function current() {
    try {
      var v = localStorage.getItem(KEY);
      return (v && THEMES[v]) ? v : 'classic';
    } catch (e) { return 'classic'; }
  }

  function ensureStyle() {
    if (document.getElementById('fateThemesStyle')) return;
    var st = document.createElement('style');
    st.id = 'fateThemesStyle';
    var css = '';
    Object.keys(THEMES).forEach(function (id) {
      if (id === 'classic') return; /* classic = pages' own defaults */
      css += 'html[data-fate-theme="' + id + '"]{';
      var vars = THEMES[id].vars;
      Object.keys(vars).forEach(function (k) { css += k + ':' + vars[k] + ';'; });
      css += '}';
    });
    st.textContent = css;
    document.head.appendChild(st);
  }

  function apply(id) {
    if (!THEMES[id]) id = 'classic';
    try { localStorage.setItem(KEY, id); } catch (e) {}
    ensureStyle();
    document.documentElement.setAttribute('data-fate-theme', id);
    try {
      document.dispatchEvent(new CustomEvent('fate-themechange', { detail: { id: id } }));
    } catch (e) {
      try { document.dispatchEvent(new Event('fate-themechange')); } catch (e2) {}
    }
  }

  function setTheme(id) { apply(id); }

  /* boot immediately — before first paint, so no flash */
  apply(current());

  /* live sync: switching the theme in another tab updates this one */
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(current());
  });

  window.FATE_THEMES = THEMES;
  window.FATE_theme = current;
  window.FATE_setTheme = setTheme;
  window.FATE_themeList = list;
})();
