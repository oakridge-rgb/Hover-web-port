/* fate-extras.js v8.3 — FATE "Storm parity" feature pack
 * Ships next to games.html / test.html (same folder). Zero deps, zero network,
 * 100% offline & school-proof. Auto-detects the host page and injects:
 *   1. THEME ENGINE  — 18 preset themes, live CSS-var theming, font picker
 *   2. BACKGROUND FX — particles / stars / matrix / waves / aurora / grid / none
 *   3. FATE TOOLS    — calculator, notes, timer, drawing pad, morse, JSON
 *                      formatter, HTML playground, bookmarklets, random game
 *   4. SORT          — Featured / A-Z / Z-A / Favorites first (patches renderGrid)
 *   5. FEATURED      — curated picks row above the search bar
 *   6. BACKUP        — export/import favorites + recents + settings as JSON
 *   7. CONFIRM LEAVE — optional beforeunload guard
 *   8. WHAT'S NEW    — changelog modal + one-time toast
 *   9. DOWNLOAD      — save the loaded game HTML from the player popup
 * Storage keys: fate_v5_theme / fate_v5_sort / fate_v5_notes / fate_v5_confirmleave
 */
(function(){
'use strict';
if (window.FATE_EXTRAS) return;
window.FATE_EXTRAS = '8.3';

/* ---------- 0. helpers ---------- */
function $(id){ return document.getElementById(id); }
function h(tag, attrs, html){
  var e = document.createElement(tag);
  if (attrs) for (var k in attrs){
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.slice(0,2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  if (html != null) e.innerHTML = html;
  return e;
}
function esc(s){ var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function store(k, v){ try{ if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){} return null; }
function hexRgb(hex){
  var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [245,158,11];
}
function rgba(hex, a){ var c = hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

/* injected stylesheet (classes + per-theme overrides live here) */
var styleEl = h('style', {id:'fateExtrasStyle'});
styleEl.textContent = [
'.fate-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
'.fate-sw{width:30px;height:30px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .15s, border-color .15s}',
'.fate-sw:hover{transform:scale(1.12)}',
'.fate-sw.on{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.25)}',
'.fate-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
'.fate-chip{padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--glass-border);color:var(--text);font-size:12px;cursor:pointer;transition:background .15s}',
'.fate-chip:hover{background:rgba(255,255,255,.12)}',
'.fate-chip.on{background:var(--primary);border-color:var(--primary);color:#0b0b0b;font-weight:700}',
'.fate-select{margin-top:10px;width:100%;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--glass-border);color:var(--text);font-size:13px;outline:none;appearance:auto}',
'.fate-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
'.fate-btn{flex:1;min-width:100px;padding:10px 12px;border-radius:12px;border:1px solid var(--glass-border);background:rgba(255,255,255,.07);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;text-align:center}',
'.fate-btn:hover{background:rgba(255,255,255,.13)}',
'.fate-btn.gold{background:var(--primary);border-color:var(--primary);color:#0b0b0b}',
/* sort select next to search */
'.fate-sort{padding:12px 14px;border-radius:14px;background:var(--glass);border:1px solid var(--glass-border);color:var(--text);font-size:14px;outline:none;cursor:pointer;backdrop-filter:blur(10px)}',
'.fate-sort option{background:#0f172a;color:#f8fafc}',
/* featured row */
'.fate-feat{margin:0 0 18px}',
'.fate-feat-head{display:flex;align-items:center;gap:8px;margin-bottom:12px}',
'.fate-feat-head h3{font-size:16px;font-weight:800;letter-spacing:.3px;color:var(--text)}',
'.fate-feat-head .spark{color:var(--primary)}',
'.fate-feat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}',
/* modals (tools + whatsnew) */
'.fate-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:20px}',
'.fate-overlay.open{display:flex}',
'.fate-modal{width:100%;max-width:860px;max-height:88vh;overflow:auto;border-radius:22px;background:var(--glass);border:1px solid var(--glass-border);backdrop-filter:blur(20px);box-shadow:0 30px 80px rgba(0,0,0,.6)}',
'.fate-modal-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:18px 22px;background:linear-gradient(180deg,rgba(10,10,12,.95),rgba(10,10,12,.75));border-bottom:1px solid var(--glass-border);z-index:2}',
'.fate-modal-head h2{font-size:19px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:10px}',
'.fate-modal-body{padding:20px 22px 26px}',
'.fate-x{width:36px;height:36px;border-radius:50%;border:1px solid var(--glass-border);background:rgba(255,255,255,.07);color:var(--text);font-size:18px;cursor:pointer;line-height:1}',
/* tools grid */
'.fate-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}',
'.fate-tool{padding:20px 16px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid var(--glass-border);cursor:pointer;text-align:center;transition:transform .15s, background .15s}',
'.fate-tool:hover{transform:translateY(-3px);background:rgba(255,255,255,.1)}',
'.fate-tool .t-ic{font-size:30px;display:block;margin-bottom:10px}',
'.fate-tool .t-nm{font-size:14px;font-weight:700;color:var(--text)}',
'.fate-tool .t-ds{font-size:11px;color:var(--text-muted);margin-top:4px}',
/* tool panels */
'.fate-panel{display:none}.fate-panel.open{display:block}',
'.fate-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid var(--glass-border);color:var(--text);font-size:13px;cursor:pointer}',
'.fate-input,.fate-ta{width:100%;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--glass-border);color:var(--text);font-size:14px;outline:none;box-sizing:border-box}',
'.fate-ta{min-height:140px;resize:vertical;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1.5}',
'.fate-out{margin-top:12px;padding:12px 14px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid var(--glass-border);color:var(--text);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap;word-break:break-word;min-height:60px}',
/* calculator */
'.fate-calc-disp{padding:16px;border-radius:14px;background:rgba(0,0,0,.4);border:1px solid var(--glass-border);text-align:right;margin-bottom:12px}',
'.fate-calc-disp .expr{font-size:12px;color:var(--text-muted);min-height:16px;word-break:break-all}',
'.fate-calc-disp .val{font-size:30px;font-weight:700;color:var(--text);word-break:break-all}',
'.fate-calc{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}',
'.fate-calc button{padding:16px 0;border-radius:14px;border:1px solid var(--glass-border);background:rgba(255,255,255,.06);color:var(--text);font-size:18px;font-weight:600;cursor:pointer;transition:background .1s}',
'.fate-calc button:hover{background:rgba(255,255,255,.13)}',
'.fate-calc button.op{background:rgba(245,158,11,.16);color:var(--primary)}',
'.fate-calc button.eq{background:var(--primary);color:#0b0b0b;font-weight:800}',
/* timer */
'.fate-timer-disp{font-size:52px;font-weight:800;text-align:center;color:var(--text);font-variant-numeric:tabular-nums;padding:18px 0;letter-spacing:2px}',
/* draw */
'.fate-draw-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}',
'.fate-draw-c{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid transparent}',
'.fate-draw-c.on{border-color:#fff}',
'.fate-draw-cv{width:100%;height:340px;border-radius:14px;border:1px solid var(--glass-border);background:#fff;cursor:crosshair;touch-action:none;display:block}',
/* bookmarklets */
'.fate-bm{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--glass-border);margin-bottom:10px}',
'.fate-bm .b-nm{font-size:13px;font-weight:700;color:var(--text)}',
'.fate-bm .b-ds{font-size:11px;color:var(--text-muted);margin-top:2px}',
/* changelog */
'.fate-cl{border-left:3px solid var(--primary);padding:2px 0 2px 16px;margin-bottom:20px}',
'.fate-cl .v{font-size:15px;font-weight:800;color:var(--text)}',
'.fate-cl .d{font-size:12px;color:var(--text-muted);margin:2px 0 8px}',
'.fate-cl ul{margin:0;padding-left:18px;color:var(--text);font-size:13.5px;line-height:1.85}',
/* toast */
'.fate-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(20px);z-index:2147483600;display:flex;align-items:center;gap:12px;padding:13px 18px;border-radius:16px;background:rgba(15,15,20,.92);border:1px solid var(--glass-border);box-shadow:0 16px 50px rgba(0,0,0,.55);color:var(--text);font-size:13.5px;opacity:0;pointer-events:none;transition:opacity .3s, transform .3s;max-width:88vw}',
'.fate-toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}',
'.fate-toast .tk{padding:6px 12px;border-radius:999px;background:var(--primary);color:#0b0b0b;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap}',
/* settings section labels */
'.fate-set-label{font-weight:700;color:var(--text);font-size:14px;margin-bottom:2px}',
'.fate-set-sub{color:var(--text-muted);font-size:12px;line-height:1.5}',
'.fate-mini{font-size:11px;color:var(--text-muted);margin-top:8px;min-height:14px}',
].join('\n');
document.head.appendChild(styleEl);

/* ---------- 1. THEME ENGINE ---------- */
var THEMES = [
 {id:'amber',   nm:'Default Amber',  p:'#f59e0b', s:'#ef4444', a:'#10b981', bg:'#050505', ov:'rgba(5,5,5,.55)',   gl:'rgba(245,158,11,.12)'},
 {id:'pink',    nm:'Hot Pink',       p:'#ec4899', s:'#f43f5e', a:'#d946ef', bg:'#0a0510', ov:'rgba(10,5,16,.6)',  gl:'rgba(236,72,153,.13)'},
 {id:'mint',    nm:'Midnight Mint',  p:'#34d399', s:'#10b981', a:'#6ee7b7', bg:'#02120c', ov:'rgba(2,18,12,.55)', gl:'rgba(52,211,153,.12)'},
 {id:'daylight',nm:'Daylight',       p:'#f59e0b', s:'#ef4444', a:'#0ea5e9', bg:'#eef2f7', ov:'rgba(255,255,255,.42)', gl:'rgba(148,163,184,.18)', tx:'#0f172a', mu:'#475569', gls:'rgba(255,255,255,.72)', gb:'rgba(15,23,42,.1)'},
 {id:'ocean',   nm:'Ocean',          p:'#38bdf8', s:'#0ea5e9', a:'#22d3ee', bg:'#020617', ov:'rgba(2,6,23,.5)',   gl:'rgba(56,189,248,.13)'},
 {id:'sunset',  nm:'Sunset',         p:'#fb923c', s:'#f43f5e', a:'#fbbf24', bg:'#150a05', ov:'rgba(21,10,5,.5)',  gl:'rgba(251,146,60,.14)'},
 {id:'ember',   nm:'Ember',          p:'#ef4444', s:'#f97316', a:'#fbbf24', bg:'#0c0404', ov:'rgba(12,4,4,.55)',  gl:'rgba(239,68,68,.13)'},
 {id:'forest',  nm:'Forest',         p:'#4ade80', s:'#16a34a', a:'#a3e635', bg:'#04120a', ov:'rgba(4,18,10,.55)', gl:'rgba(74,222,128,.12)'},
 {id:'gold',    nm:'Gold',           p:'#fbbf24', s:'#d97706', a:'#fde68a', bg:'#0d0a02', ov:'rgba(13,10,2,.55)', gl:'rgba(251,191,36,.14)'},
 {id:'ice',     nm:'Ice',            p:'#7dd3fc', s:'#38bdf8', a:'#e0f2fe', bg:'#060d14', ov:'rgba(6,13,20,.5)',  gl:'rgba(125,211,252,.14)'},
 {id:'mono',    nm:'Mono',           p:'#a1a1aa', s:'#71717a', a:'#e4e4e7', bg:'#09090b', ov:'rgba(9,9,11,.55)',  gl:'rgba(161,161,170,.12)'},
 {id:'matrix',  nm:'Matrix',         p:'#22c55e', s:'#16a34a', a:'#4ade80', bg:'#010803', ov:'rgba(1,8,3,.6)',    gl:'rgba(34,197,94,.13)'},
 {id:'cyber',   nm:'Cyberpunk',      p:'#f0abfc', s:'#22d3ee', a:'#fde047', bg:'#0d0221', ov:'rgba(13,2,33,.55)', gl:'rgba(240,171,252,.13)'},
 {id:'matcha',  nm:'Matcha',         p:'#a3e635', s:'#65a30d', a:'#d9f99d', bg:'#0b1205', ov:'rgba(11,18,5,.5)',  gl:'rgba(163,230,53,.13)'},
 {id:'lavender',nm:'Lavender',       p:'#c4b5fd', s:'#a78bfa', a:'#e9d5ff', bg:'#0b0817', ov:'rgba(11,8,23,.5)',  gl:'rgba(196,181,253,.13)'},
 {id:'cherry',  nm:'Cherry',         p:'#fb7185', s:'#f43f5e', a:'#fda4af', bg:'#12040a', ov:'rgba(18,4,10,.55)', gl:'rgba(251,113,133,.14)'},
 {id:'space',   nm:'Deep Space',     p:'#818cf8', s:'#6366f1', a:'#c7d2fe', bg:'#020212', ov:'rgba(2,2,18,.55)',  gl:'rgba(129,140,248,.14)'},
 {id:'vapor',   nm:'Vaporwave',      p:'#f472b6', s:'#38bdf8', a:'#a78bfa', bg:'#0f0524', ov:'rgba(15,5,36,.55)', gl:'rgba(244,114,182,.14)'}
];
var FONTS = [
 {id:'inter', nm:'Modern (Inter)', f:'"Inter",system-ui,sans-serif'},
 {id:'sys',   nm:'System',         f:'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'},
 {id:'round', nm:'Rounded',        f:'ui-rounded,"Hiragino Maru Gothic ProN","Quicksand","Comfortaa","Segoe UI",system-ui,sans-serif'},
 {id:'serif', nm:'Classic Serif',  f:'Georgia,"Times New Roman",Cambria,serif'},
 {id:'mono',  nm:'Retro Terminal', f:'ui-monospace,Menlo,Consolas,"Courier New",monospace'},
 {id:'comic', nm:'Comic',          f:'"Comic Sans MS","Chalkboard SE",cursive'}
];
var BGS = ['particles','stars','matrix','waves','aurora','grid','none'];

function getThemeCfg(){
  try{ var c = JSON.parse(store('fate_v5_theme') || '{}');
    return {theme:c.theme||'amber', bg:c.bg||'particles', font:c.font||'inter'};
  }catch(e){ return {theme:'amber', bg:'particles', font:'inter'}; }
}
function applyTheme(cfg){
  cfg = cfg || getThemeCfg();
  var t = THEMES.find(function(x){return x.id===cfg.theme;}) || THEMES[0];
  var f = FONTS.find(function(x){return x.id===cfg.font;}) || FONTS[0];
  var r = document.documentElement.style;
  r.setProperty('--primary', t.p);
  r.setProperty('--secondary', t.s);
  r.setProperty('--accent', t.a);
  r.setProperty('--bg-deep', t.bg);
  r.setProperty('--glass', t.gls || 'rgba(0,0,0,0.55)');
  r.setProperty('--glass-border', t.gb || 'rgba(255,255,255,0.1)');
  r.setProperty('--text', t.tx || '#f8fafc');
  r.setProperty('--text-muted', t.mu || '#cbd5e1');
  document.body.style.fontFamily = f.f;
  /* overlay + mouse glow ride the accent */
  var ovRule = '.bg-overlay{background:' + t.ov + ' !important}';
  var glowRule = '#mouseGlow{background:radial-gradient(circle,' + t.gl + ' 0%,transparent 70%)}';
  var swatchRule = '.fate-sort option,.fate-select option{background:' + (t.tx ? '#f1f5f9' : '#0f172a') + ';color:' + (t.tx ? '#0f172a' : '#f8fafc') + '}';
  var ex = $('fateThemeStyle') || (function(){ var s = h('style',{id:'fateThemeStyle'}); document.head.appendChild(s); return s; })();
  ex.textContent = ovRule + glowRule + swatchRule;
  try{ store('fate_v5_theme', JSON.stringify(cfg)); }catch(e){}
  if (window.__fateFxSetBg) window.__fateFxSetBg(cfg.bg);
  paintSettingsUI();
}

/* ---------- 2. BACKGROUND FX painters ---------- */
(function fx(){
  var cv = h('canvas', {id:'fateFxCanvas'});
  cv.style.cssText = 'position:fixed;inset:0;z-index:2;pointer-events:none;display:none';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');
  var mode = 'particles', raf = null, last = 0, W = 0, H = 0, stars = [], drops = [], t0 = Date.now();

  function size(){
    W = cv.width = window.innerWidth; H = cv.height = window.innerHeight;
    stars = []; for (var i = 0; i < 220; i++) stars.push({x:Math.random()*W, y:Math.random()*H, r:Math.random()*1.4+.3, ph:Math.random()*6.28, sp:.4+Math.random()*1.4});
    drops = []; var cols = Math.ceil(W/16);
    for (var c = 0; c < cols; c++) drops.push({x:c*16, y:Math.random()*-H, sp:2+Math.random()*4, len:8+(Math.random()*14|0)});
  }
  function accent(){ var cs = getComputedStyle(document.documentElement); return (cs.getPropertyValue('--primary')||'#f59e0b').trim(); }
  function accentRgb(){ var cs = getComputedStyle(document.documentElement); var v=(cs.getPropertyValue('--primary')||'#f59e0b').trim(); return hexRgb(v); }

  function drawStars(ts){
    ctx.clearRect(0,0,W,H);
    var a = accentRgb();
    for (var i = 0; i < stars.length; i++){
      var s = stars[i], tw = .35 + .65 * Math.abs(Math.sin(ts/900*s.sp + s.ph));
      ctx.fillStyle = 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + (tw*.85).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
  }
  var glyphs = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01<>[]{}$#*+=;';
  function drawMatrix(){
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0,0,W,H);
    var a = accentRgb();
    ctx.font = '13px monospace';
    for (var i = 0; i < drops.length; i++){
      var d = drops[i];
      for (var j = 0; j < d.len; j++){
        var y = d.y - j*16; if (y < 0 || y > H) continue;
        var al = j === 0 ? .95 : (.75 - j/d.len*.75);
        ctx.fillStyle = 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al.toFixed(3) + ')';
        ctx.fillText(glyphs[(Math.random()*glyphs.length)|0], d.x, y);
      }
      d.y += d.sp*2.2;
      if (d.y - d.len*16 > H) { d.y = Math.random()*-200; d.sp = 2+Math.random()*4; }
    }
  }
  function drawWaves(ts){
    ctx.clearRect(0,0,W,H);
    var a = accentRgb(), rgb = a[0]+','+a[1]+','+a[2];
    for (var w = 0; w < 3; w++){
      ctx.beginPath();
      var amp = 34 + w*22, base = H*(.55 + w*.14), sp = ts/(2400 - w*500);
      for (var x = 0; x <= W; x += 8){
        var y = base + Math.sin(x/220 + sp + w*1.7)*amp + Math.sin(x/90 - sp*1.4)*10;
        x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (.34 - w*.09).toFixed(2) + ')';
      ctx.lineWidth = 2 - w*.4; ctx.stroke();
    }
  }
  function drawAurora(ts){
    ctx.globalCompositeOperation = 'lighter';
    ctx.clearRect(0,0,W,H);
    var a = accentRgb(), c2 = [a[2], a[0], a[1]];
    for (var b = 0; b < 4; b++){
      var cx = W*(.5 + .38*Math.sin(ts/(9000+b*2600) + b*1.9));
      var cy = H*(.35 + .3*Math.cos(ts/(11000+b*3100) + b*1.2));
      var rad = 240 + b*90;
      var g = ctx.createRadialGradient(cx,cy,0,cx,cy,rad);
      var col = b%2 ? c2 : a;
      g.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,rad,0,6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawGrid(ts){
    ctx.clearRect(0,0,W,H);
    var a = accentRgb(), rgb = a[0]+','+a[1]+','+a[2];
    var hz = H*.5;
    ctx.strokeStyle = 'rgba(' + rgb + ',.14)'; ctx.lineWidth = 1;
    for (var i = -14; i <= 14; i++){ ctx.beginPath(); ctx.moveTo(W/2 + i*40, hz); ctx.lineTo(W/2 + i*W/7, H); ctx.stroke(); }
    for (var y = hz, k = 1; y < H; k++){
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      y += 4*k;
    }
    var py = hz + ((ts/28) % (H-hz));
    ctx.strokeStyle = 'rgba(' + rgb + ',.4)'; ctx.beginPath(); ctx.moveTo(0,py); ctx.lineTo(W,py); ctx.stroke();
  }

  var painters = {stars:drawStars, matrix:drawMatrix, waves:drawWaves, aurora:drawAurora, grid:drawGrid};
  var intervals = {stars:70, matrix:60, waves:33, aurora:40, grid:45};
  function loop(ts){
    raf = null;
    if (document.hidden){ schedule(); return; }
    var iv = intervals[mode] || 60;
    if (ts - last >= iv){ last = ts; (painters[mode] || function(){})(ts); }
    schedule();
  }
  function schedule(){ if (mode !== 'none' && painters[mode] && !raf) raf = requestAnimationFrame(loop); }
  window.__fateFxSetBg = function(m){
    mode = m;
    if (raf){ cancelAnimationFrame(raf); raf = null; }
    var pc = $('particleCanvas'), mg = $('mouseGlow');
    if (m === 'particles' || m === 'none'){
      cv.style.display = 'none'; ctx.clearRect(0,0,W,H);
      if (pc) pc.style.display = m === 'particles' ? '' : 'none';
      if (mg) mg.style.display = m === 'none' ? 'none' : '';
      return;
    }
    if (pc) pc.style.display = 'none';
    if (mg) mg.style.display = '';
    size(); cv.style.display = 'block'; schedule();
  };
  window.addEventListener('resize', function(){ if (mode !== 'particles' && mode !== 'none') size(); });
  size();
})();

/* apply saved theme immediately (before first paint of UI) */
applyTheme();

/* ---------- 3. FATE TOOLS SUITE ---------- */
var toolsModal = null, toolGrid = null, toolPanelHost = null;
var TOOLS = [
 {id:'calc',  ic:'🧮', nm:'Calculator',      ds:'Quick math, keyboard ready'},
 {id:'notes', ic:'📝', nm:'Notes',           ds:'Autosaved scratchpad'},
 {id:'timer', ic:'⏱️', nm:'Timer',           ds:'Countdown + stopwatch'},
 {id:'draw',  ic:'🎨', nm:'Drawing Pad',     ds:'Sketch & save PNG'},
 {id:'morse', ic:'·−', nm:'Morse Code',      ds:'Translate text ↔ morse'},
 {id:'json',  ic:'{}', nm:'JSON Formatter',  ds:'Pretty print & validate'},
 {id:'html',  ic:'⌨️', nm:'HTML Playground', ds:'Live code preview'},
 {id:'bmk',   ic:'✂️', nm:'Bookmarklets',    ds:'One-click page tricks'},
 {id:'rand',  ic:'🎲', nm:'Random Game',     ds:'Roll the 22k vault'}
];

function ensureToolsModal(){
  if (toolsModal) return;
  toolsModal = h('div', {class:'fate-overlay', id:'fateToolsModal'});
  var modal = h('div', {class:'fate-modal'});
  modal.innerHTML =
    '<div class="fate-modal-head"><h2>🧰 FATE Tools <span style="font-size:11px;color:var(--text-muted);font-weight:600">all offline</span></h2>' +
    '<button class="fate-x" title="Close">✕</button></div>' +
    '<div class="fate-modal-body"><div class="fate-panel open" data-p="grid"></div></div>';
  toolsModal.appendChild(modal);
  document.body.appendChild(toolsModal);
  toolGrid = modal.querySelector('[data-p="grid"]');
  toolGrid.className = 'fate-tools';
  toolPanelHost = modal.querySelector('.fate-modal-body');
  modal.querySelector('.fate-x').addEventListener('click', function(){ toggleTools(false); });
  toolsModal.addEventListener('click', function(e){ if (e.target === toolsModal) toggleTools(false); });
  buildPanels();
}
function openPanel(id){
  toolPanelHost.querySelectorAll('.fate-panel').forEach(function(p){ p.classList.toggle('open', p.dataset.p === id); });
}
function showGrid(){
  openPanel('grid');
}
function backBtn(){
  return h('button', {class:'fate-back', html:'← All tools', onclick:function(){ showGrid(); }});
}
function buildPanels(){
  /* grid of tools */
  TOOLS.forEach(function(t){
    var card = h('div', {class:'fate-tool', html:
      '<span class="t-ic">' + t.ic + '</span><div class="t-nm">' + t.nm + '</div><div class="t-ds">' + t.ds + '</div>'});
    card.addEventListener('click', function(){
      if (t.id === 'rand'){ rollRandom(); return; }
      openPanel('p-' + t.id);
      if (t.id === 'draw' && window.__fateDrawResize) setTimeout(window.__fateDrawResize, 60);
    });
    toolGrid.appendChild(card);
  });

  /* ---- calculator ---- */
  var pCalc = h('div', {class:'fate-panel', 'data-p':'p-calc'});
  pCalc.appendChild(backBtn());
  pCalc.innerHTML += '<div class="fate-calc-disp"><div class="expr" id="fateCalcExpr"></div><div class="val" id="fateCalcVal">0</div></div>';
  var pad = h('div', {class:'fate-calc'});
  var keys = ['AC','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','(',  '='];
  var calcExpr = '';
  function calcEval(){
    try{
      var js = calcExpr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/%/g,'/100');
      if (/^[-+*/(). 0-9]*$/.test(js) && js.trim()){
        var v = Function('"use strict";return(' + js + ')')();
        if (v === undefined || v === null || isNaN(v)) throw 0;
        return String(Math.round(v * 1e10) / 1e10);
      }
    }catch(e){}
    return null;
  }
  function calcPress(k){
    if (k === 'AC'){ calcExpr = ''; pCalc.querySelector('#fateCalcVal').textContent = '0'; pCalc.querySelector('#fateCalcExpr').textContent = ''; return; }
    if (k === '⌫'){ calcExpr = calcExpr.slice(0,-1); }
    else if (k === '='){ var r = calcEval(); if (r !== null){ pCalc.querySelector('#fateCalcExpr').textContent = calcExpr + ' ='; calcExpr = r; } else { pCalc.querySelector('#fateCalcExpr').textContent = 'invalid'; return; } }
    else calcExpr += k;
    pCalc.querySelector('#fateCalcVal').textContent = calcExpr || '0';
    var live = calcEval(); pCalc.querySelector('#fateCalcExpr').textContent = live !== null && k !== '=' ? (calcExpr + ' = ' + live) : pCalc.querySelector('#fateCalcExpr').textContent;
  }
  keys.forEach(function(k){
    var b = h('button', {html:k});
    if ('÷×−+%'.indexOf(k) >= 0) b.className = 'op';
    if (k === '=') b.className = 'eq';
    b.addEventListener('click', function(){ calcPress(k); });
    pad.appendChild(b);
  });
  pCalc.appendChild(pad);
  pCalc.addEventListener('keydown', function(e){
    var map = {'/':'÷','*':'×','-':'−','Enter':'=','Backspace':'⌫','Escape':'AC'};
    var k = map[e.key] || e.key;
    if ('0123456789.+()'.indexOf(k) >= 0 || map[e.key]) { calcPress(k); e.preventDefault(); }
  });
  pCalc.tabIndex = -1;
  toolPanelHost.appendChild(pCalc);

  /* ---- notes ---- */
  var pNotes = h('div', {class:'fate-panel', 'data-p':'p-notes'});
  pNotes.appendChild(backBtn());
  pNotes.innerHTML += '<div class="fate-set-label">Scratchpad</div><div class="fate-set-sub">Autosaves to this browser as you type. Survives reloads & offline.</div>' +
    '<textarea class="fate-ta" id="fateNotesTa" style="min-height:300px;margin-top:12px" placeholder="Write anything — homework, cheat sheets, links…"></textarea>' +
    '<div class="fate-mini" id="fateNotesMeta"></div>';
  toolPanelHost.appendChild(pNotes);
  var ta = pNotes.querySelector('#fateNotesTa');
  ta.value = store('fate_v5_notes') || '';
  var tmo = null;
  function notesMeta(){
    var w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    pNotes.querySelector('#fateNotesMeta').textContent = w + ' words · saved ✓';
  }
  ta.addEventListener('input', function(){
    notesMeta();
    clearTimeout(tmo);
    tmo = setTimeout(function(){ try{ store('fate_v5_notes', ta.value); }catch(e){} }, 300);
  });
  notesMeta();

  /* ---- timer ---- */
  var pTimer = h('div', {class:'fate-panel', 'data-p':'p-timer'});
  pTimer.appendChild(backBtn());
  var tMode = 'cd', tIv = null, tEnd = 0, tLeft = 300000, tStart = 0, tAcc = 0, tRun = false;
  pTimer.innerHTML += '<div class="fate-chips" style="margin:0 0 14px">' +
      '<button class="fate-chip on" data-m="cd">Countdown</button><button class="fate-chip" data-m="sw">Stopwatch</button></div>' +
    '<div class="fate-timer-disp" id="fateTimerDisp">05:00</div>' +
    '<div class="fate-row" id="fateTimerCd" style="justify-content:center">' +
      '<button class="fate-btn" data-min="1">1 min</button><button class="fate-btn" data-min="5">5 min</button>' +
      '<button class="fate-btn" data-min="10">10 min</button><button class="fate-btn" data-min="25">25 min</button></div>' +
    '<div class="fate-row" style="justify-content:center;margin-top:14px">' +
      '<button class="fate-btn gold" id="fateTimerGo">Start</button><button class="fate-btn" id="fateTimerRst">Reset</button></div>';
  toolPanelHost.appendChild(pTimer);
  var disp = pTimer.querySelector('#fateTimerDisp'), goB = pTimer.querySelector('#fateTimerGo');
  function fmt(ms){ var s = Math.max(0, Math.round(ms/1000)); return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }
  function beep(){
    try{
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, .28, .56].forEach(function(dl){
        var o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.frequency.value = 880; o.type = 'sine';
        g.gain.setValueAtTime(.001, ac.currentTime + dl);
        g.gain.exponentialRampToValueAtTime(.25, ac.currentTime + dl + .02);
        g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + dl + .22);
        o.start(ac.currentTime + dl); o.stop(ac.currentTime + dl + .24);
      });
    }catch(e){}
  }
  function tick(){
    if (tMode === 'cd'){
      var left = tRun ? tEnd - Date.now() : tLeft;
      disp.textContent = fmt(left);
      if (tRun && left <= 0){ clearInterval(tIv); tIv = null; tRun = false; disp.textContent = '00:00'; goB.textContent = 'Start'; beep(); toast('⏰ Time is up!'); }
    } else {
      disp.textContent = fmt(tRun ? (Date.now() - tStart + tAcc) : tAcc);
    }
  }
  pTimer.querySelectorAll('[data-min]').forEach(function(b){
    b.addEventListener('click', function(){ clearInterval(tIv); tIv = null; tRun = false; tLeft = (+b.dataset.min) * 60000; disp.textContent = fmt(tLeft); goB.textContent = 'Start'; });
  });
  goB.addEventListener('click', function(){
    if (tMode === 'cd'){
      if (tRun){ clearInterval(tIv); tIv = null; tRun = false; tLeft = Math.max(0, tEnd - Date.now()); goB.textContent = 'Resume'; }
      else { tEnd = Date.now() + tLeft; tRun = true; goB.textContent = 'Pause'; tIv = setInterval(tick, 200); }
    } else {
      if (tRun){ tAcc += Date.now() - tStart; tRun = false; goB.textContent = 'Resume'; }
      else { tStart = Date.now(); tRun = true; goB.textContent = 'Stop'; }
    }
  });
  pTimer.querySelector('#fateTimerRst').addEventListener('click', function(){
    clearInterval(tIv); tIv = null; tRun = false;
    if (tMode === 'cd'){ tLeft = 300000; disp.textContent = '05:00'; } else { tAcc = 0; disp.textContent = '00:00'; }
    goB.textContent = 'Start';
  });
  pTimer.querySelectorAll('[data-m]').forEach(function(b){
    b.addEventListener('click', function(){
      pTimer.querySelectorAll('[data-m]').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on'); tMode = b.dataset.m;
      clearInterval(tIv); tIv = null; tRun = false; goB.textContent = 'Start';
      pTimer.querySelector('#fateTimerCd').style.display = tMode === 'cd' ? '' : 'none';
      disp.textContent = tMode === 'cd' ? '05:00' : '00:00';
    });
  });

  /* ---- drawing pad ---- */
  var pDraw = h('div', {class:'fate-panel', 'data-p':'p-draw'});
  pDraw.appendChild(backBtn());
  var bar = h('div', {class:'fate-draw-bar'});
  var dcv = h('canvas', {class:'fate-draw-cv'});
  var dctx = dcv.getContext('2d'), dCol = '#f59e0b', dSize = 4, dDown = false, dErase = false;
  ['#0f172a','#f59e0b','#ec4899','#38bdf8','#4ade80','#ffffff'].forEach(function(c, i){
    var s = h('div', {class:'fate-draw-c' + (i === 1 ? ' on' : '')});
    s.style.background = c;
    s.addEventListener('click', function(){ dCol = c; dErase = false; bar.querySelectorAll('.fate-draw-c').forEach(function(x){x.classList.remove('on')}); s.classList.add('on'); });
    bar.appendChild(s);
  });
  var sz = h('input', {type:'range', min:'1', max:'24', value:'4', style:'flex:1;min-width:120px'});
  sz.addEventListener('input', function(){ dSize = +sz.value; });
  var eb = h('button', {class:'fate-btn', html:'🧽 Erase', style:'flex:0'});
  eb.addEventListener('click', function(){ dErase = !dErase; eb.style.background = dErase ? 'var(--primary)' : ''; eb.style.color = dErase ? '#0b0b0b' : ''; });
  var cb = h('button', {class:'fate-btn', html:'Clear', style:'flex:0'});
  cb.addEventListener('click', function(){ dctx.fillStyle = '#fff'; dctx.fillRect(0,0,dcv.width,dcv.height); });
  var sb = h('button', {class:'fate-btn gold', html:'Save PNG', style:'flex:0'});
  sb.addEventListener('click', function(){
    try{
      var a = document.createElement('a');
      a.download = 'fate-drawing.png'; a.href = dcv.toDataURL('image/png'); a.click();
    }catch(e){ toast('Could not save drawing'); }
  });
  bar.appendChild(sz); bar.appendChild(eb); bar.appendChild(cb); bar.appendChild(sb);
  pDraw.appendChild(bar); pDraw.appendChild(dcv);
  toolPanelHost.appendChild(pDraw);
  function dresize(){
    var old = dcv.width ? dcv.toDataURL() : null;
    dcv.width = dcv.clientWidth || 700; dcv.height = 340;
    dctx.fillStyle = '#fff'; dctx.fillRect(0,0,dcv.width,dcv.height);
    if (old){ var im = new Image(); im.onload = function(){ dctx.drawImage(im,0,0); }; im.src = old; }
  }
  window.__fateDrawResize = dresize;
  function dpos(e){ var r = dcv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  dcv.addEventListener('pointerdown', function(e){ dDown = true; dcv.setPointerCapture(e.pointerId); var p = dpos(e); dctx.beginPath(); dctx.moveTo(p[0], p[1]); });
  dcv.addEventListener('pointermove', function(e){
    if (!dDown) return;
    var p = dpos(e);
    dctx.lineCap = 'round'; dctx.lineJoin = 'round';
    dctx.lineWidth = dSize;
    if (dErase){ dctx.globalCompositeOperation = 'destination-out'; dctx.lineWidth = dSize * 3; }
    else dctx.globalCompositeOperation = 'source-over';
    dctx.strokeStyle = dCol;
    dctx.lineTo(p[0], p[1]); dctx.stroke();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(function(ev){ dcv.addEventListener(ev, function(){ dDown = false; }); });

  /* ---- morse ---- */
  var MORSE = {a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',j:'.---',k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',s:'...',t:'-',u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','.':'.-.-.-',',':'--..--','?':'..--..','!':'-.-.--','/':'-..-.','@':'.--.-.','-':'-....-','(':'-.--.',')':'-.--.-'};
  var REV = {}; Object.keys(MORSE).forEach(function(k){ REV[MORSE[k]] = k; });
  var pMorse = h('div', {class:'fate-panel', 'data-p':'p-morse'});
  pMorse.appendChild(backBtn());
  pMorse.innerHTML += '<div class="fate-set-label">Text ↔ Morse</div><div class="fate-set-sub">Type on either side — it translates live. Detects morse automatically.</div>' +
    '<textarea class="fate-ta" id="fateMorseIn" style="min-height:100px;margin-top:12px" placeholder="Type text here (or morse like .... ..)"></textarea>' +
    '<textarea class="fate-ta" id="fateMorseOut" style="min-height:100px;margin-top:10px" placeholder="Translation appears here"></textarea>' +
    '<div class="fate-row"><button class="fate-btn" id="fateMorseCopy">Copy morse</button></div>';
  toolPanelHost.appendChild(pMorse);
  var mi = pMorse.querySelector('#fateMorseIn'), mo = pMorse.querySelector('#fateMorseOut');
  function mEncode(s){ return s.toLowerCase().split(/\s+/).map(function(w){ return w.split('').map(function(c){ return MORSE[c] || ''; }).filter(Boolean).join(' '); }).join(' / '); }
  function mDecode(s){ return s.trim().split(/\s*\/\s*/).map(function(w){ return w.split(/\s+/).map(function(m){ return REV[m] || ''; }).join(''); }).join(' '); }
  var lastMorseEdit = 'in';
  mi.addEventListener('input', function(){ lastMorseEdit = 'in'; if (/^[.\-\/\s]+$/.test(mi.value) && mi.value.trim()) mo.value = mDecode(mi.value); else mo.value = mEncode(mi.value); });
  mo.addEventListener('input', function(){ lastMorseEdit = 'out'; mi.value = mDecode(mo.value); });
  pMorse.querySelector('#fateMorseCopy').addEventListener('click', function(){
    (navigator.clipboard ? navigator.clipboard.writeText(mo.value) : Promise.reject()).then(function(){ toast('Copied ✓'); }, function(){ toast('Select & copy manually'); });
  });

  /* ---- json formatter ---- */
  var pJson = h('div', {class:'fate-panel', 'data-p':'p-json'});
  pJson.appendChild(backBtn());
  pJson.innerHTML += '<textarea class="fate-ta" id="fateJsonIn" placeholder=\'{"paste":"json here"}\'></textarea>' +
    '<div class="fate-row"><button class="fate-btn gold" id="fateJsonGo">Format</button><button class="fate-btn" id="fateJsonMin">Minify</button></div>' +
    '<div class="fate-out" id="fateJsonOut">Result…</div>';
  toolPanelHost.appendChild(pJson);
  function jsonRun(min){
    var out = pJson.querySelector('#fateJsonOut');
    try{
      var v = JSON.parse(pJson.querySelector('#fateJsonIn').value);
      out.textContent = JSON.stringify(v, null, min ? 0 : 2);
      out.style.color = 'var(--text)';
    }catch(e){ out.textContent = '✕ Invalid JSON — ' + e.message; out.style.color = '#f87171'; }
  }
  pJson.querySelector('#fateJsonGo').addEventListener('click', function(){ jsonRun(false); });
  pJson.querySelector('#fateJsonMin').addEventListener('click', function(){ jsonRun(true); });

  /* ---- html playground ---- */
  var pHtml = h('div', {class:'fate-panel', 'data-p':'p-html'});
  pHtml.appendChild(backBtn());
  pHtml.innerHTML += '<textarea class="fate-ta" id="fateHtmlIn" style="min-height:170px" spellcheck="false">&lt;h1 style="font-family:sans-serif"&gt;Hello FATE 👋&lt;/h1&gt;\n&lt;button onclick="alert(\'it works!\')"&gt;Click me&lt;/button&gt;</textarea>' +
    '<div class="fate-row"><button class="fate-btn gold" id="fateHtmlRun">▶ Run</button></div>' +
    '<iframe id="fateHtmlFrame" style="width:100%;height:260px;margin-top:12px;border-radius:12px;border:1px solid var(--glass-border);background:#fff" sandbox="allow-scripts allow-modals"></iframe>';
  toolPanelHost.appendChild(pHtml);
  pHtml.querySelector('#fateHtmlRun').addEventListener('click', function(){
    var v = pHtml.querySelector('#fateHtmlIn').value;
    var ta2 = document.createElement('textarea'); ta2.innerHTML = v;
    pHtml.querySelector('#fateHtmlFrame').srcdoc = ta2.value;
  });

  /* ---- bookmarklets ---- */
  var BMS = [
   ['Edit Any Page', 'Click any text on the page and edit it like a doc', "javascript:(function(){document.designMode=document.designMode==='on'?'off':'on'})();"],
   ['Reveal Passwords', 'Show saved passwords behind ●●●●', "javascript:(function(){document.querySelectorAll('input[type=password]').forEach(function(i){i.type='text'})})();"],
   ['Dark Mode Any Site', 'Invert colors on any page', "javascript:(function(){var d=document.documentElement;d.style.filter='invert(1) hue-rotate(180deg)';d.style.background='#fff'})();"],
   ['Sticky Note', 'Drop a draggable sticky note on any page', "javascript:(function(){var n=document.createElement('textarea');n.style.cssText='position:fixed;top:70px;right:20px;width:240px;height:160px;z-index:999999;padding:10px;border-radius:10px;border:none;box-shadow:0 10px 40px rgba(0,0,0,.4);background:#fde68a;color:#111;font:14px sans-serif';document.body.appendChild(n)})();"]
  ];
  var pBm = h('div', {class:'fate-panel', 'data-p':'p-bmk'});
  pBm.appendChild(backBtn());
  pBm.innerHTML += '<div class="fate-set-sub" style="margin-bottom:12px">Tap copy, then paste into a bookmark\u2019s URL field. Run it by opening the bookmark on any page.</div>';
  BMS.forEach(function(b){
    var row = h('div', {class:'fate-bm', html:'<div><div class="b-nm">' + b[0] + '</div><div class="b-ds">' + b[1] + '</div></div>'});
    var cp = h('button', {class:'fate-btn gold', html:'Copy', style:'flex:0;min-width:70px;padding:8px'});
    cp.addEventListener('click', function(){
      (navigator.clipboard ? navigator.clipboard.writeText(b[2]) : Promise.reject()).then(function(){ toast('Copied ✓'); }, function(){ toast('Copy failed'); });
    });
    row.appendChild(cp);
    pBm.appendChild(row);
  });
  toolPanelHost.appendChild(pBm);
}
function toggleTools(force){
  ensureToolsModal();
  var open = force !== undefined ? force : !toolsModal.classList.contains('open');
  toolsModal.classList.toggle('open', open);
  if (open) showGrid();
}
function rollRandom(){
  try{
    var pool = (typeof allGames !== 'undefined' && allGames && allGames.length) ? allGames : null;
    if (!pool){ toast('Catalog not loaded yet'); return; }
    var g = pool[Math.floor(Math.random() * pool.length)];
    toggleTools(false);
    if (typeof window.openGame === 'function') openGame(g.id);
    else toast('Open ' + g.name);
  }catch(e){}
}

/* toast helper (shared) */
var toastEl = null, toastTm = null;
function toast(msg, actionLabel, onAction){
  if (!toastEl){
    toastEl = h('div', {class:'fate-toast'});
    document.body.appendChild(toastEl);
  }
  toastEl.innerHTML = '<span>' + msg + '</span>';
  if (actionLabel){
    var k = h('span', {class:'tk', html:actionLabel});
    k.addEventListener('click', function(){ hideToast(); onAction && onAction(); });
    toastEl.appendChild(k);
  }
  requestAnimationFrame(function(){ toastEl.classList.add('show'); });
  clearTimeout(toastTm);
  toastTm = setTimeout(hideToast, 6000);
}
function hideToast(){ if (toastEl) toastEl.classList.remove('show'); }

/* ---------- 4. SORT (patches renderGrid) ---------- */
var SORTS = [
 {id:'featured', nm:'✦ Featured'},
 {id:'az',       nm:'Name A–Z'},
 {id:'za',       nm:'Name Z–A'},
 {id:'fav',      nm:'♥ Favorites first'}
];
function currentSort(){ return store('fate_v5_sort') || 'featured'; }
function applySortToVisible(){
  var mode = currentSort();
  if (mode === 'featured' || typeof visibleGames === 'undefined' || !Array.isArray(visibleGames)) return;
  var favs = {};
  try{ (JSON.parse(store('fate_v5_favorites') || '[]')).forEach(function(id){ favs[id] = 1; }); }catch(e){}
  var cmp;
  if (mode === 'az') cmp = function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); };
  else if (mode === 'za') cmp = function(a,b){ return String(b.name||'').localeCompare(String(a.name||'')); };
  else cmp = function(a,b){
    var fa = favs[a.id] ? 0 : 1, fb = favs[b.id] ? 0 : 1;
    return fa !== fb ? fa - fb : String(a.name||'').localeCompare(String(b.name||''));
  };
  try{ visibleGames.sort(cmp); }catch(e){}
}

/* ---------- 5. FEATURED PICKS ROW ---------- */
var FEATURED_NAMES = ['bowmasters','slope','geometry dash','cookie clicker','2048','subway surfers','basket random','flappy','retro bowl','drift boss','hole.io','paper.io'];
function buildFeatured(){
  var anchor = $('recentSection');
  if (!anchor || $('fateFeatured')) return;
  var pool = (typeof allGames !== 'undefined' && allGames) ? allGames : [];
  var names = pool.map(function(g){ return String(g.name||'').toLowerCase(); });
  var picks = [];
  FEATURED_NAMES.forEach(function(q){
    var idx = names.findIndex(function(n){ return n.indexOf(q) >= 0; });
    if (idx >= 0 && !picks.some(function(p){ return p.id === pool[idx].id; })) picks.push(pool[idx]);
  });
  if (picks.length < 4) picks = pool.slice(0, 8);
  if (!picks.length) return;
  var sec = h('div', {class:'fate-feat', id:'fateFeatured'});
  sec.innerHTML = '<div class="fate-feat-head"><span class="spark">✦</span><h3>Featured picks</h3></div><div class="fate-feat-grid"></div>';
  var grid = sec.querySelector('.fate-feat-grid');
  picks.slice(0, 8).forEach(function(g){
    var card = h('div', {class:'game-card', html:
      '<div class="img-wrap">' +
      '<img data-src="' + (typeof getGameImage === 'function' ? getGameImage(g) : '') + '" alt="' + esc(g.name||'Game') + '" class="game-img" loading="lazy" onload="this.classList.remove(\'loading\')" onerror="this.style.opacity=\'0\'" />' +
      '<div class="play-overlay"><div class="play-btn"><svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>' +
      '<button class="fav-btn ' + (typeof isFav === 'function' && isFav(g.id) ? 'active' : '') + '" onclick="event.stopPropagation();toggleFav(\'' + g.id + '\')" title="Favorite"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>' +
      '</div><div class="game-info"><p class="game-name">' + esc(g.name || 'Untitled') + '</p></div>'});
    card.addEventListener('click', function(){ if (typeof window.openGame === 'function') openGame(g.id); });
    grid.appendChild(card);
  });
  anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  try{
    requestAnimationFrame(function(){
      sec.querySelectorAll('img[data-src]').forEach(function(img){
        if (window.imgObserver) imgObserver.observe(img);
        else img.src = img.getAttribute('data-src');
      });
    });
  }catch(e){}
}
function syncFeatured(){
  var sec = $('fateFeatured');
  if (!sec) return;
  var si = $('searchInput');
  var searching = si && si.value && si.value.trim().length > 0;
  sec.style.display = searching ? 'none' : '';
}

/* ---------- 6. BACKUP & RESTORE ---------- */
function backupExport(){
  try{
    var data = {app:'FATE', version:'8.3', exported:new Date().toISOString(), data:{}};
    Object.keys(localStorage).forEach(function(k){
      if (/^fate_v5_/.test(k) || k === 'CTRLLERMAP') data.data[k] = localStorage.getItem(k);
    });
    var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fate-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
    toast('Backup saved ✓ (' + Object.keys(data.data).length + ' keys)');
  }catch(e){ toast('Backup failed: ' + e.message); }
}
function backupImport(file){
  var fr = new FileReader();
  fr.onload = function(){
    try{
      var j = JSON.parse(fr.result);
      if (!j || !j.data) throw new Error('not a FATE backup');
      var n = 0;
      Object.keys(j.data).forEach(function(k){
        if (/^fate_v5_/.test(k) || k === 'CTRLLERMAP'){ localStorage.setItem(k, j.data[k]); n++; }
      });
      toast('Restored ' + n + ' keys — reloading…');
      setTimeout(function(){ location.reload(); }, 1200);
    }catch(e){ toast('Import failed: ' + e.message); }
  };
  fr.readAsText(file);
}

/* ---------- 7. CONFIRM BEFORE LEAVING ---------- */
function syncConfirmLeave(){
  var on = store('fate_v5_confirmleave') === '1';
  window.onbeforeunload = on ? function(e){ e.preventDefault(); e.returnValue = ''; return ''; } : null;
}

/* ---------- 8. WHAT'S NEW ---------- */
var CHANGELOG = [
 {v:'v8.3 · Feature Pack', d:'Storm-level customization arrives in FATE', items:[
  '18 themes — accent, background, text & glass recolor the whole site live',
  '6 animated backgrounds: starfield, matrix rain, waves, aurora, grid, or none',
  '6 fonts including Retro Terminal & Rounded',
  'FATE Tools: calculator, notes, timer, drawing pad, morse, JSON formatter, HTML playground, bookmarklets, random game',
  'Sort the vault: Name A–Z, Z–A, favorites first',
  'Featured picks row for instant hits',
  'Backup & restore — favorites, recents and settings as one file',
  'Download button saves a loaded game\u2019s HTML',
  'Optional confirm-before-leaving guard'
 ]},
 {v:'v8.2', d:'Stability', items:[
  'Fixed the infinite boot loop — service worker forced same-origin',
  '22.7k game vault on 100% jsDelivr — zero jet, fetch+blob direct play'
 ]}
];
function ensureNewsModal(){
  if ($('fateNewsModal')) return;
  var ov = h('div', {class:'fate-overlay', id:'fateNewsModal'});
  var modal = h('div', {class:'fate-modal', style:'max-width:640px'});
  var body = '<div class="fate-modal-head"><h2>✦ What\u2019s new in FATE</h2><button class="fate-x">✕</button></div><div class="fate-modal-body">';
  CHANGELOG.forEach(function(c){
    body += '<div class="fate-cl"><div class="v">' + c.v + '</div><div class="d">' + c.d + '</div><ul>';
    c.items.forEach(function(it){ body += '<li>' + it + '</li>'; });
    body += '</ul></div>';
  });
  body += '</div>';
  modal.innerHTML = body;
  ov.appendChild(modal);
  document.body.appendChild(ov);
  modal.querySelector('.fate-x').addEventListener('click', function(){ ov.classList.remove('open'); });
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.classList.remove('open'); });
}
function toggleNews(force){
  ensureNewsModal();
  var ov = $('fateNewsModal');
  var open = force !== undefined ? force : !ov.classList.contains('open');
  ov.classList.toggle('open', open);
  if (open) try{ store('fate_v5_seen_83', '1'); }catch(e){}
}

/* ---------- 9. DOWNLOAD BUTTON IN PLAYER ---------- */
function addDownloadBtn(){
  var bar = $('newTabBtn');
  if (!bar || $('fateDlBtn')) return;
  var b = h('button', {class:bar.className, id:'fateDlBtn', title:'Download game HTML'});
  b.innerHTML = '<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
  b.addEventListener('click', function(){
    try{
      var fr = $('gameFrame');
      var src = fr && fr.src || '';
      if (!src){ toast('Nothing loaded yet'); return; }
      var name = ((window.currentGame && currentGame.name) || 'game').replace(/[^\w\- ]+/g,'').trim() || 'game';
      if (src.indexOf('blob:') === 0){
        fetch(src).then(function(r){ return r.blob(); }).then(function(bl){
          var a = document.createElement('a');
          a.href = URL.createObjectURL(bl); a.download = name + '.html'; a.click();
          setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
          toast('Saved ' + name + '.html ✓');
        }).catch(function(){ toast('Download failed'); });
      } else {
        var a2 = document.createElement('a');
        a2.href = src; a2.download = name + '.html'; a2.target = '_blank'; a2.rel = 'noopener';
        document.body.appendChild(a2); a2.click(); a2.remove();
      }
    }catch(e){ toast('Download failed'); }
  });
  bar.parentNode.insertBefore(b, bar.nextSibling);
}

/* ---------- 10. SETTINGS UI + FAB ENTRY ---------- */
function paintSettingsUI(){
  var body = document.querySelector('#settingsPanel .settings-body');
  if (!body) return;
  var cfg = getThemeCfg();
  var sec = $('fateSetSection');
  if (!sec){
    sec = h('div', {id:'fateSetSection'});
    body.appendChild(sec);
  }
  var sw = THEMES.map(function(t){
    return '<div class="fate-sw' + (t.id === cfg.theme ? ' on' : '') + '" data-t="' + t.id + '" title="' + t.nm + '" style="background:linear-gradient(135deg,' + t.p + ',' + t.a + ')"></div>';
  }).join('');
  var bgc = BGS.map(function(b){
    return '<button class="fate-chip' + (b === cfg.bg ? ' on' : '') + '" data-b="' + b + '">' + b + '</button>';
  }).join('');
  var fo = FONTS.map(function(f){
    return '<option value="' + f.id + '"' + (f.id === cfg.font ? ' selected' : '') + '>' + f.nm + '</option>';
  }).join('');
  sec.innerHTML =
    '<div class="setting"><div class="fate-set-label">🎨 Theme</div><div class="fate-set-sub">18 moods — recolors everything instantly</div><div class="fate-swatches">' + sw + '</div></div>' +
    '<div class="setting"><div class="fate-set-label">🌌 Background FX</div><div class="fate-chips">' + bgc + '</div></div>' +
    '<div class="setting"><div class="fate-set-label">🔤 Font</div><select class="fate-select" id="fateFontSel">' + fo + '</select></div>' +
    '<div class="setting"><div class="fate-set-label">💾 Backup & Restore</div><div class="fate-set-sub">Favorites, recents, theme & settings as one file</div>' +
      '<div class="fate-row"><button class="fate-btn gold" id="fateBkExp">Export</button><button class="fate-btn" id="fateBkImp">Import</button>' +
      '<input type="file" id="fateBkFile" accept=".json,application/json" style="display:none"></div></div>' +
    '<div class="setting"><div class="fate-set-label">🚪 Confirm before leaving</div><div class="fate-set-sub">Ask when the tab is about to close mid-game</div>' +
      '<div class="toggle' + (store('fate_v5_confirmleave') === '1' ? ' active' : '') + '" id="fateClToggle" style="margin-top:10px"></div></div>' +
    '<div class="setting"><div class="fate-set-label">✦ What\u2019s new</div><div class="fate-row"><button class="fate-btn" id="fateNewsBtn">See v8.3 features</button></div></div>';
  sec.querySelectorAll('.fate-sw').forEach(function(el){
    el.addEventListener('click', function(){
      cfg.theme = el.dataset.t; applyTheme(cfg);
      toast('Theme: ' + (THEMES.find(function(t){return t.id===cfg.theme;})||{}).nm);
    });
  });
  sec.querySelectorAll('[data-b]').forEach(function(el){
    el.addEventListener('click', function(){
      cfg.bg = el.dataset.b; applyTheme(cfg);
    });
  });
  sec.querySelector('#fateFontSel').addEventListener('change', function(e){ cfg.font = e.target.value; applyTheme(cfg); });
  sec.querySelector('#fateBkExp').addEventListener('click', backupExport);
  sec.querySelector('#fateBkImp').addEventListener('click', function(){ sec.querySelector('#fateBkFile').click(); });
  sec.querySelector('#fateBkFile').addEventListener('change', function(e){ if (e.target.files && e.target.files[0]) backupImport(e.target.files[0]); });
  var clT = sec.querySelector('#fateClToggle');
  clT.addEventListener('click', function(){
    var on = !clT.classList.contains('active');
    clT.classList.toggle('active', on);
    try{ store('fate_v5_confirmleave', on ? '1' : '0'); }catch(e){}
    syncConfirmLeave();
  });
  sec.querySelector('#fateNewsBtn').addEventListener('click', function(){ toggleSettings && toggleSettings(false); toggleNews(true); });
}
function addFabEntry(){
  var menu = $('fabMenu');
  if (!menu || $('fateToolsFab')) return;
  var discord = menu.querySelector('a[href*="discord"]');
  var item = h('a', {class:'fab-item', id:'fateToolsFab', html:
    '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg><span>Tools</span>'});
  item.addEventListener('click', function(e){ e.preventDefault(); toggleFab && toggleFab(false); toggleTools(true); });
  if (discord) menu.insertBefore(item, discord); else menu.appendChild(item);
}

/* ---------- INIT ---------- */
function initExtras(){
  try{ addFabEntry(); }catch(e){}
  /* sort select next to search */
  try{
    var sw = document.querySelector('.search-wrap');
    if (sw && !$('fateSortSel')){
      var sel = h('select', {class:'fate-sort', id:'fateSortSel'});
      SORTS.forEach(function(s){
        var o = h('option', {value:s.id, html:s.nm});
        if (s.id === currentSort()) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function(){
        try{ store('fate_v5_sort', sel.value); }catch(e){}
        if (typeof window.renderGrid === 'function') renderGrid();
      });
      sw.parentNode.insertBefore(sel, sw.nextSibling);
    }
  }catch(e){}
  /* patch renderGrid: sort visible games + sync featured visibility */
  try{
    if (typeof window.renderGrid === 'function' && !window.__fateRenderPatched){
      window.__fateRenderPatched = true;
      var orig = window.renderGrid;
      window.renderGrid = function(){
        try{ applySortToVisible(); }catch(e){}
        var r = orig.apply(this, arguments);
        try{ syncFeatured(); }catch(e){}
        return r;
      };
    }
  }catch(e){}
  /* featured row once catalog is in */
  try{
    var tries = 0;
    (function waitCat(){
      var n = 0;
      try{ n = (typeof allGames !== 'undefined' && allGames) ? allGames.length : 0; }catch(e){}
      if (n || tries > 120) { try{ buildFeatured(); if (typeof renderGrid === 'function') renderGrid(); }catch(e){} return; }
      tries++; setTimeout(waitCat, 500);
    })();
  }catch(e){}
  try{ addDownloadBtn(); }catch(e){}
  try{ syncConfirmLeave(); }catch(e){}
  try{ paintSettingsUI(); }catch(e){}
  /* one-time what's-new toast */
  try{
    if (store('fate_v5_seen_83') !== '1'){
      setTimeout(function(){
        toast('✦ <b>v8.3 is live</b> — 18 themes, Tools & more', 'See what\u2019s new', function(){ toggleNews(true); });
      }, 2500);
    }
  }catch(e){}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initExtras);
else initExtras();
/* re-hook when settings panel is (re)built or popup opens */
var __mo = new MutationObserver(function(){
  try{
    if (!window.__fateMoThrottle){
      window.__fateMoThrottle = true;
      setTimeout(function(){
        window.__fateMoThrottle = false;
        try{ addDownloadBtn(); }catch(e){}
        try{ if (!$('fateSetSection')) paintSettingsUI(); }catch(e){}
        try{ addFabEntry(); }catch(e){}
      }, 400);
    }
  }catch(e){}
});
try{ __mo.observe(document.body, {childList:true, subtree:true}); }catch(e){}
})();
