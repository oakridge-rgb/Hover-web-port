/* ============================================================
   FlipaClip Studio — core app (state, canvas, tools, timeline)
   ============================================================ */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rctx = c => c.getContext('2d', { willReadFrequently: true });   // for pixels we read
const pctx = c => c.getContext('2d');                                  // plain

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function toast(msg, ms) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, ms || 2600);
}

/* ---------- icons ---------- */
const ICONS = {
  brush: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  eraser: '<path d="M20 20H9"/><path d="M15.5 3.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L11 18H6l-3-3a2.1 2.1 0 0 1 0-3l9.5-9.5z"/><path d="M8.5 10.5l5 5"/>',
  fill: '<path d="M12 3l7 7-6.3 6.3a2 2 0 0 1-2.8 0L5 11.4a2 2 0 0 1 0-2.8L12 3z"/><path d="M5 11h13"/><path d="M20.5 16.5s1.5 2 1.5 3.2a1.5 1.5 0 0 1-3 0c0-1.2 1.5-3.2 1.5-3.2z"/>',
  lasso: '<circle cx="12" cy="9" r="6.5"/><path d="M8.5 14.5c-.6 2.4-2.3 3.6-4.5 4.5 1.8.6 3.6.5 5-.3"/>',
  line: '<path d="M5 19L19 5"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
  picker: '<path d="M14 9L5.5 17.5 4 21l3.5-1.5L16 11"/><path d="M16.8 3.2l4 4-2.8 2.8-4-4 2.8-2.8z"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9.5a6 6 0 0 1 0 12H10"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9h-9.5a6 6 0 0 0 0 12H14"/>',
  onion: '<rect x="8.5" y="3" width="12.5" height="12.5" rx="2"/><rect x="3" y="8.5" width="12.5" height="12.5" rx="2"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  play: '<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
  start: '<path d="M19 5v14L8 12z" fill="currentColor" stroke="none"/><path d="M5 5v14"/>',
  end: '<path d="M5 5v14l11-7z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
  prev: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  loop: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.94 17.94A10.4 10.4 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.9 9.9 0 0 1 12 5c7 0 11 7 11 7a19.8 19.8 0 0 1-3.22 4.31"/><path d="M1 1l22 22"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  clear: '<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/>',
  gif: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10H8.5a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 8.5 14H10v-1.5"/><path d="M12.5 10v4M15 14v-4h2.5M15 12h2"/>',
  film: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
};
function icon(name) {
  return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
}
function mountIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon) + (el.dataset.label ? '<span>' + el.dataset.label + '</span>' : '');
  });
}

/* ---------- state ---------- */
const AUTO_KEY = 'flipaclone.autosave.v1';
const PRESET_COLORS = ['#111111', '#ffffff', '#ff4d4d', '#ff9f43', '#ffd32a', '#32ff7e', '#18dcff', '#7d5fff', '#c56cf0', '#ff6b81', '#8d6e63', '#95a5a6'];

const S = {
  proj: null,          // {name,w,h,fps,bg,layers:[{id,name,visible,opacity}],frames:[{id,c:[canvas]}]}
  cf: 0, cl: 0,        // current frame / layer index
  tool: 'brush',
  color: '#111111',
  size: 6,
  opacity: 1,
  tol: 28,
  fillShape: false,
  onion: false, grid: false, loop: true,
  zoom: 1, autoFit: true,
  playing: false,
  audio: null,
  recents: PRESET_COLORS.slice(),
  history: { undo: [], redo: [] },
  autosaveOff: false,
  cursor: null,
  drawing: false,
};
let P = null;
let stripCards = [];
let lasso = null;      // {pts,mode:'draw'|'move',dx,dy,before,drag}
let stroke = null;     // active stroke state
let beforePix = null;  // ImageData before current pixel op
let pan = null;
let spaceHeld = false;

/* ---------- canvases / buffers ---------- */
const disp = $('#disp'), dctx = pctx(disp);
const ovl = $('#ovl'), octx = pctx(ovl);
const stagewrap = $('#stagewrap'), stagebox = $('#stagebox');
let tmpA, tmpB, tmp2, strokeBuf, selMask, pieceBuf;
let tActx, tBctx, t2ctx, sctx, mctx, p2ctx;

function resizeBuffers() {
  tmpA = mkCanvas(P.w, P.h); tActx = pctx(tmpA);
  tmpB = mkCanvas(P.w, P.h); tBctx = pctx(tmpB);
  tmp2 = mkCanvas(P.w, P.h); t2ctx = pctx(tmp2);
  strokeBuf = mkCanvas(P.w, P.h); sctx = pctx(strokeBuf);
  selMask = mkCanvas(P.w, P.h); mctx = pctx(selMask);
  pieceBuf = mkCanvas(P.w, P.h); p2ctx = pctx(pieceBuf);
  disp.width = P.w; disp.height = P.h;
  ovl.width = P.w; ovl.height = P.h;
}

/* ---------- project ---------- */
function newFrameObj() {
  return { id: uid(), c: P.layers.map(() => mkCanvas(P.w, P.h)) };
}
function cloneFrame(f) {
  return { id: uid(), c: f.c.map(cv => { const n = mkCanvas(P.w, P.h); pctx(n).drawImage(cv, 0, 0); return n; }) };
}
function createProject(name, w, h, fps, bg) {
  P = {
    name: name || 'My Animation', w: w | 0, h: h | 0,
    fps: clamp(fps || 12, 1, 60), bg: bg || '#ffffff',
    layers: [{ id: uid(), name: 'Layer 1', visible: true, opacity: 1 }],
    frames: [],
  };
  P.frames.push(newFrameObj());
  S.cf = 0; S.cl = 0;
  S.history.undo.length = 0; S.history.redo.length = 0;
}

function setProject(p) {
  P = p;
  S.cf = 0; S.cl = P.layers.length - 1;
  S.history.undo.length = 0; S.history.redo.length = 0;
  lasso = null; stroke = null; S.drawing = false;
  $('#app').hidden = false;
  resizeBuffers();
  $('#projName').value = P.name;
  $('#fpsVal').textContent = P.fps;
  updateUndoUI();
  rebuildStrip(); rebuildLayerList(); updateToolUI();
  fitZoom();
  render(); updateCounter();
  scheduleAutosave();
}

/* ---------- rendering ---------- */
function compositeLayersTo(cx, fi, opts) {
  opts = opts || {};
  const f = P.frames[fi];
  if (!f) return;
  if (opts.bg) { cx.fillStyle = P.bg; cx.fillRect(0, 0, P.w, P.h); }
  const live = opts.live && fi === S.cf && !S.playing;
  for (let li = 0; li < P.layers.length; li++) {
    const L = P.layers[li];
    if (!L.visible) continue;
    const cv = f.c[li];
    if (!cv) continue;
    const isCur = live && li === S.cl;
    if (isCur && S.drawing && (S.tool === 'eraser')) {
      t2ctx.clearRect(0, 0, P.w, P.h);
      t2ctx.drawImage(cv, 0, 0);
      t2ctx.save();
      t2ctx.globalCompositeOperation = 'destination-out';
      t2ctx.globalAlpha = S.opacity;
      t2ctx.drawImage(strokeBuf, 0, 0);
      t2ctx.restore();
      cx.globalAlpha = L.opacity;
      cx.drawImage(tmp2, 0, 0);
    } else {
      cx.globalAlpha = L.opacity;
      cx.drawImage(cv, 0, 0);
      if (isCur && S.drawing && (S.tool === 'brush' || S.tool === 'line' || S.tool === 'rect' || S.tool === 'ellipse')) {
        cx.globalAlpha = L.opacity * S.opacity;
        cx.drawImage(strokeBuf, 0, 0);
      }
    }
    if (isCur && lasso && lasso.mode === 'move') {
      cx.globalAlpha = L.opacity;
      cx.drawImage(pieceBuf, Math.round(lasso.dx), Math.round(lasso.dy));
    }
  }
  cx.globalAlpha = 1;
}

function tintFrame(fi, color, alpha) {
  tActx.clearRect(0, 0, P.w, P.h);
  compositeLayersTo(tActx, fi, {});
  tBctx.clearRect(0, 0, P.w, P.h);
  tBctx.drawImage(tmpA, 0, 0);
  tBctx.globalCompositeOperation = 'source-in';
  tBctx.fillStyle = color;
  tBctx.fillRect(0, 0, P.w, P.h);
  tBctx.globalCompositeOperation = 'source-over';
  dctx.globalAlpha = alpha;
  dctx.drawImage(tmpB, 0, 0);
  dctx.globalAlpha = 1;
}

function drawGrid() {
  dctx.save();
  dctx.strokeStyle = 'rgba(0,0,0,.16)';
  dctx.lineWidth = 1;
  dctx.beginPath();
  for (let i = 1; i < 3; i++) {
    const x = Math.round(P.w * i / 3) + 0.5, y = Math.round(P.h * i / 3) + 0.5;
    dctx.moveTo(x, 0); dctx.lineTo(x, P.h);
    dctx.moveTo(0, y); dctx.lineTo(P.w, y);
  }
  dctx.stroke();
  dctx.restore();
}

function render() {
  if (!P) return;
  dctx.clearRect(0, 0, P.w, P.h);
  dctx.fillStyle = P.bg;
  dctx.fillRect(0, 0, P.w, P.h);
  if (S.onion && !S.playing) {
    if (S.cf > 0) tintFrame(S.cf - 1, '#ff4d4d', 0.28);
    if (S.cf < P.frames.length - 1) tintFrame(S.cf + 1, '#2bd06b', 0.28);
  }
  compositeLayersTo(dctx, S.cf, { live: true });
  if (S.grid && !S.playing) drawGrid();
  drawOverlay();
}

function drawOverlay() {
  if (!P) return;
  octx.clearRect(0, 0, P.w, P.h);
  if (lasso) {
    octx.save();
    octx.lineWidth = 1.5;
    octx.setLineDash([6, 5]);
    let pts = lasso.pts;
    if (lasso.mode === 'move') pts = lasso.pts.map(p => ({ x: p.x + lasso.dx, y: p.y + lasso.dy }));
    if (pts && pts.length > 1) {
      pathPoly(octx, pts);
      octx.strokeStyle = 'rgba(255,255,255,.95)';
      octx.stroke();
      octx.strokeStyle = 'rgba(0,0,0,.6)';
      octx.setLineDash([]);
      octx.lineWidth = 0.75;
      octx.stroke();
    }
    octx.restore();
  }
  if ((S.tool === 'brush' || S.tool === 'eraser') && S.cursor && !S.playing && !lasso) {
    octx.save();
    octx.lineWidth = 2.5;
    octx.strokeStyle = 'rgba(0,0,0,.45)';
    octx.beginPath();
    octx.arc(S.cursor.x, S.cursor.y, Math.max(0.5, S.size / 2), 0, Math.PI * 2);
    octx.stroke();
    octx.lineWidth = 1;
    octx.strokeStyle = 'rgba(255,255,255,.95)';
    octx.stroke();
    octx.restore();
  }
}

function pathPoly(cx, pts) {
  cx.beginPath();
  cx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i].x, pts[i].y);
  cx.closePath();
}

/* ---------- frame strip (timeline) ---------- */
function rebuildStrip() {
  const strip = $('#framestrip');
  const sl = strip.scrollLeft;
  strip.innerHTML = '';
  stripCards = P.frames.map((f, i) => {
    const el = document.createElement('div');
    el.className = 'fcard' + (i === S.cf ? ' on' : '');
    el.draggable = true;
    const cv = mkCanvas(192, 108);
    el.appendChild(cv);
    const lb = document.createElement('div');
    lb.className = 'flabel';
    lb.textContent = String(i + 1);
    el.appendChild(lb);
    const act = document.createElement('div');
    act.className = 'fact';
    const bDup = document.createElement('button');
    bDup.innerHTML = icon('copy');
    bDup.title = 'Duplicate frame';
    bDup.onclick = ev => { ev.stopPropagation(); addFrame(true, i); };
    const bDel = document.createElement('button');
    bDel.innerHTML = icon('trash');
    bDel.title = 'Delete frame';
    bDel.onclick = ev => { ev.stopPropagation(); delFrame(i); };
    act.appendChild(bDup); act.appendChild(bDel);
    el.appendChild(act);
    el.onclick = () => { if (!S.playing) setCurFrame(i); };
    el.addEventListener('dragstart', e => {
      dragFrom = i;
      try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) { }
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dropmark'); });
    el.addEventListener('dragleave', () => el.classList.remove('dropmark'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('dropmark');
      if (dragFrom < 0 || dragFrom === i) return;
      let to = i; if (dragFrom < i) to = i - 1;
      moveFrame(dragFrom, to);
      dragFrom = -1;
    });
    strip.appendChild(el);
    return { el, canvas: cv, tctx: pctx(cv) };
  });
  strip.appendChild(stripAddBtn);
  strip.scrollLeft = sl;
  drawAllThumbs();
}

const stripAddBtn = document.createElement('button');
stripAddBtn.id = 'stripAdd';
stripAddBtn.title = 'Add frame at end';
stripAddBtn.innerHTML = icon('plus');
stripAddBtn.onclick = () => addFrame(false, P.frames.length - 1);

let dragFrom = -1;

function updateStripSelection() {
  stripCards.forEach((c, i) => c.el.classList.toggle('on', i === S.cf));
}
function drawThumb(fi) {
  const card = stripCards[fi];
  if (!card) return;
  const t = card.tctx;
  t.clearRect(0, 0, 192, 108);
  t.fillStyle = P.bg;
  t.fillRect(0, 0, 192, 108);
  const f = P.frames[fi];
  if (!f) return;
  const k = Math.min(192 / P.w, 108 / P.h);
  const dx = (192 - P.w * k) / 2, dy = (108 - P.h * k) / 2;
  for (let li = 0; li < P.layers.length; li++) {
    const L = P.layers[li];
    if (!L.visible) continue;
    t.globalAlpha = L.opacity;
    t.drawImage(f.c[li], dx, dy, P.w * k, P.h * k);
  }
  t.globalAlpha = 1;
}
function drawAllThumbs() { for (let i = 0; i < P.frames.length; i++) drawThumb(i); }

function scrollStripTo(i) {
  const card = stripCards[i];
  if (!card) return;
  const strip = $('#framestrip');
  const el = card.el;
  if (el.offsetLeft < strip.scrollLeft + 10) strip.scrollLeft = el.offsetLeft - 10;
  else if (el.offsetLeft + el.offsetWidth > strip.scrollLeft + strip.clientWidth - 10)
    strip.scrollLeft = el.offsetLeft + el.offsetWidth - strip.clientWidth + 10;
}

/* ---------- layer list ---------- */
function rebuildLayerList() {
  const list = $('#layerList');
  list.innerHTML = '';
  for (let li = P.layers.length - 1; li >= 0; li--) {
    const L = P.layers[li];
    const row = document.createElement('div');
    row.className = 'lrow' + (li === S.cl ? ' on' : '') + (L.visible ? '' : ' hid');
    const eye = document.createElement('button');
    eye.className = 'eye';
    eye.innerHTML = icon(L.visible ? 'eye' : 'eyeoff');
    eye.title = 'Toggle visibility';
    eye.onclick = e => {
      e.stopPropagation();
      L.visible = !L.visible;
      rebuildLayerList(); render(); drawAllThumbs(); scheduleAutosave();
    };
    const cv = mkCanvas(68, 40);
    const tc = pctx(cv);
    const f = P.frames[S.cf];
    if (f && f.c[li]) tc.drawImage(f.c[li], 0, 0, 68, 40);
    const nm = document.createElement('span');
    nm.className = 'lname';
    nm.textContent = L.name;
    nm.title = 'Double-click to rename';
    nm.ondblclick = e => {
      e.stopPropagation();
      const inp = document.createElement('input');
      inp.className = 'rename';
      inp.value = L.name;
      nm.replaceWith(inp);
      inp.focus(); inp.select();
      const done = () => {
        L.name = inp.value.trim() || L.name;
        rebuildLayerList(); scheduleAutosave();
      };
      inp.onblur = done;
      inp.onkeydown = ev => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = L.name; inp.blur(); } };
    };
    row.appendChild(eye); row.appendChild(nm); row.appendChild(cv);
    row.onclick = () => {
      S.cl = li;
      rebuildLayerList(); render(); drawOverlay(); syncLayerFoot();
    };
    list.appendChild(row);
  }
  syncLayerFoot();
}

function syncLayerFoot() {
  const L = P.layers[S.cl];
  const op = $('#layerOpacity');
  op.value = Math.round(L.opacity * 100);
  $('#layerOpacityVal').textContent = Math.round(L.opacity * 100) + '%';
  $('#layerUp').disabled = S.cl >= P.layers.length - 1;
  $('#layerDown').disabled = S.cl <= 0;
  $('#layerDel').disabled = P.layers.length <= 1;
}

/* ---------- history (closure commands) ---------- */
function pushCmd(cmd) {
  S.history.undo.push(cmd);
  if (S.history.undo.length > 60) S.history.undo.shift();
  S.history.redo.length = 0;
  updateUndoUI();
  scheduleAutosave();
}
function snapshotLayer(fi, li) {
  return rctx(P.frames[fi].c[li]).getImageData(0, 0, P.w, P.h);
}
function applyPix(fid, lid, img) {
  const fi = P.frames.findIndex(f => f.id === fid);
  const li = P.layers.findIndex(l => l.id === lid);
  if (fi < 0 || li < 0) return;
  const cv = P.frames[fi].c[li];
  if (cv) rctx(cv).putImageData(img, 0, 0);
}
function pushPixelsCmd(fi, li, before, after) {
  const fid = P.frames[fi].id, lid = P.layers[li].id;
  pushCmd({
    undo: () => applyPix(fid, lid, before),
    redo: () => applyPix(fid, lid, after),
  });
}
function updateUndoUI() {
  $('#btnUndo').disabled = S.history.undo.length === 0;
  $('#btnRedo').disabled = S.history.redo.length === 0;
}
function undo() {
  const c = S.history.undo.pop();
  if (!c) return;
  c.undo();
  S.history.redo.push(c);
  refreshAfterHistory();
}
function redo() {
  const c = S.history.redo.pop();
  if (!c) return;
  c.redo();
  S.history.undo.push(c);
  refreshAfterHistory();
}
function refreshAfterHistory() {
  if (!P) return;
  if (lasso && lasso.mode === 'move') cancelLasso();
  S.cf = clamp(S.cf, 0, P.frames.length - 1);
  S.cl = clamp(S.cl, 0, P.layers.length - 1);
  rebuildStrip(); rebuildLayerList();
  $('#projName').value = P.name;
  $('#fpsVal').textContent = P.fps;
  render(); updateCounter(); updateUndoUI();
  scheduleAutosave();
}

/* ---------- frame ops ---------- */
function addFrame(copy, at) {
  stopPlay();
  if (typeof at !== 'number') at = S.cf;
  const nf = copy ? cloneFrame(P.frames[at]) : newFrameObj();
  const idx = at + 1;
  P.frames.splice(idx, 0, nf);
  S.cf = idx;
  pushCmd({
    undo() { P.frames.splice(idx, 1); if (S.cf >= P.frames.length) S.cf = P.frames.length - 1; },
    redo() { P.frames.splice(idx, 0, nf); },
  });
  rebuildStrip(); render(); updateCounter();
  scrollStripTo(S.cf);
}
function delFrame(i) {
  stopPlay();
  if (P.frames.length <= 1) { toast('A project needs at least one frame'); return; }
  i = clamp(i, 0, P.frames.length - 1);
  const removed = P.frames.splice(i, 1)[0];
  S.cf = clamp(i, 0, P.frames.length - 1);
  pushCmd({
    undo() { P.frames.splice(i, 0, removed); },
    redo() { P.frames.splice(i, 1); },
  });
  rebuildStrip(); render(); updateCounter();
}
function moveFrame(from, to) {
  stopPlay();
  if (from === to) return;
  const f = P.frames.splice(from, 1)[0];
  P.frames.splice(to, 0, f);
  if (S.cf === from) S.cf = to;
  pushCmd({
    undo() { P.frames.splice(to, 1); P.frames.splice(from, 0, f); },
    redo() { P.frames.splice(from, 1); P.frames.splice(to, 0, f); },
  });
  rebuildStrip(); render(); updateCounter();
}
function setCurFrame(i) {
  i = clamp(i, 0, P.frames.length - 1);
  if (i === S.cf) return;
  S.cf = i;
  updateStripSelection(); render(); updateCounter();
  scrollStripTo(i);
}
function updateCounter() {
  $('#frameCounter').textContent = (S.cf + 1) + ' / ' + P.frames.length;
}

/* ---------- layer ops ---------- */
function addLayer() {
  stopPlay();
  const pos = P.layers.length; // new top layer
  const meta = { id: uid(), name: 'Layer ' + (P.layers.length + 1), visible: true, opacity: 1 };
  const cvs = P.frames.map(() => mkCanvas(P.w, P.h));
  P.frames.forEach((f, i) => f.c.splice(pos, 0, cvs[i]));
  P.layers.splice(pos, 0, meta);
  S.cl = pos;
  pushCmd({
    undo() {
      P.frames.forEach(f => f.c.splice(pos, 1));
      P.layers.splice(pos, 1);
      if (S.cl >= P.layers.length) S.cl = P.layers.length - 1;
    },
    redo() {
      P.frames.forEach((f, i) => f.c.splice(pos, 0, cvs[i]));
      P.layers.splice(pos, 0, meta);
    },
  });
  rebuildLayerList(); render(); drawAllThumbs();
}
function delLayer() {
  stopPlay();
  if (P.layers.length <= 1) { toast('A project needs at least one layer'); return; }
  const pos = S.cl;
  const meta = P.layers[pos];
  const cols = P.frames.map(f => f.c[pos]);
  P.frames.forEach(f => f.c.splice(pos, 1));
  P.layers.splice(pos, 1);
  S.cl = clamp(pos, 0, P.layers.length - 1);
  pushCmd({
    undo() {
      P.frames.forEach((f, i) => f.c.splice(pos, 0, cols[i]));
      P.layers.splice(pos, 0, meta);
    },
    redo() {
      P.frames.forEach(f => f.c.splice(pos, 1));
      P.layers.splice(pos, 1);
    },
  });
  rebuildLayerList(); render(); drawAllThumbs();
}
function moveLayer(from, to) {
  stopPlay();
  if (to < 0 || to >= P.layers.length || from === to) return;
  const meta = P.layers[from];
  P.layers.splice(from, 1); P.layers.splice(to, 0, meta);
  P.frames.forEach(f => {
    const cv = f.c.splice(from, 1)[0];
    f.c.splice(to, 0, cv);
  });
  S.cl = to;
  pushCmd({
    undo() {
      const m = P.layers.splice(to, 1)[0]; P.layers.splice(from, 0, m);
      P.frames.forEach(f => { const cv = f.c.splice(to, 1)[0]; f.c.splice(from, 0, cv); });
    },
    redo() {
      const m = P.layers.splice(from, 1)[0]; P.layers.splice(to, 0, m);
      P.frames.forEach(f => { const cv = f.c.splice(from, 1)[0]; f.c.splice(to, 0, cv); });
    },
  });
  rebuildLayerList(); render(); drawAllThumbs();
}
function clearLayer() {
  const cv = P.frames[S.cf].c[S.cl];
  const before = snapshotLayer(S.cf, S.cl);
  rctx(cv).clearRect(0, 0, P.w, P.h);
  pushPixelsCmd(S.cf, S.cl, before, snapshotLayer(S.cf, S.cl));
  render(); drawThumb(S.cf);
}

/* ---------- tools ---------- */
const TOOL_NAMES = ['brush', 'eraser', 'fill', 'lasso', 'line', 'rect', 'ellipse', 'picker'];
function setTool(t) {
  if (!TOOL_NAMES.includes(t)) return;
  if (lasso && lasso.mode === 'move') commitLasso();
  S.tool = t;
  updateToolUI();
  drawOverlay();
}
function updateToolUI() {
  $$('#toolbar .tool').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  const shape = S.tool === 'rect' || S.tool === 'ellipse';
  $('#opacityOpt').hidden = S.tool === 'fill' || S.tool === 'picker' || S.tool === 'lasso';
  $('#tolOpt').hidden = S.tool !== 'fill';
  $('#fillOpt').hidden = !shape;
  disp.style.cursor = (S.tool === 'brush' || S.tool === 'eraser') ? 'none'
    : S.tool === 'picker' ? 'copy' : 'crosshair';
}
function setSize(v) {
  S.size = clamp(Math.round(v), 1, 80);
  $('#sizeRange').value = S.size;
  $('#sizeVal').textContent = S.size + ' px';
  drawOverlay();
}
function setColor(hex) {
  S.color = hex;
  $('#colorSwatch').value = hex;
  S.recents = [hex, ...S.recents.filter(c => c !== hex)].slice(0, 12);
  buildPalette();
}
function buildPalette() {
  const box = $('#palette');
  box.innerHTML = '';
  S.recents.forEach(c => {
    const b = document.createElement('button');
    b.className = 'pal';
    b.style.background = c;
    b.title = c;
    b.onclick = () => setColor(c);
    box.appendChild(b);
  });
}

/* ---------- pointer input ---------- */
function toCanvas(e) {
  const r = disp.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * P.w / r.width,
    y: (e.clientY - r.top) * P.h / r.height,
  };
}

disp.addEventListener('pointerdown', e => {
  if (!P || S.playing || anyModalOpen()) return;
  if (S.spaceHeld || e.button === 1) return; // pan handled by stagewrap
  if (e.button !== 0) return;
  disp.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  toolDown(p, e);
});
disp.addEventListener('pointermove', e => {
  if (!P) return;
  S.cursor = toCanvas(e);
  if (!S.drawing || S.playing) { drawOverlay(); return; }
  const p = S.cursor;
  if (S.tool === 'brush' || S.tool === 'eraser') {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs.length ? evs : [e]) extendStroke(toCanvas(ev));
  } else if (S.tool === 'line' || S.tool === 'rect' || S.tool === 'ellipse') {
    shapeTo(p, e.shiftKey);
  } else if (S.tool === 'lasso') {
    lassoMove(p);
  }
  drawOverlay();
});
const pointerEnd = e => {
  if (!S.drawing) return;
  if (S.tool === 'brush' || S.tool === 'eraser' || S.tool === 'line' || S.tool === 'rect' || S.tool === 'ellipse') endStroke();
  else if (S.tool === 'lasso') lassoUp();
  S.drawing = false;
};
disp.addEventListener('pointerup', pointerEnd);
disp.addEventListener('pointercancel', pointerEnd);
disp.addEventListener('pointerleave', () => { S.cursor = null; drawOverlay(); });

function toolDown(p, e) {
  if (S.tool === 'picker') { pickColor(p); return; }
  if (S.tool === 'fill') { doFill(p); return; }
  if (S.tool === 'lasso') { lassoDown(p); S.drawing = true; return; }
  beginStroke(p);
  S.drawing = true;
}

function beginStroke(p) {
  sctx.clearRect(0, 0, P.w, P.h);
  sctx.save();
  sctx.lineWidth = S.size;
  sctx.lineCap = 'round';
  sctx.lineJoin = 'round';
  sctx.strokeStyle = S.color;
  sctx.fillStyle = S.color;
  stroke = { last: p, mid: p, start: p };
  if (S.tool === 'brush' || S.tool === 'eraser') {
    sctx.beginPath();
    sctx.arc(p.x, p.y, Math.max(0.1, S.size / 2), 0, Math.PI * 2);
    sctx.fill();
  }
  beforePix = snapshotLayer(S.cf, S.cl);
}
function extendStroke(p) {
  if (!stroke) return;
  const a = stroke.last;
  if (Math.abs(p.x - a.x) + Math.abs(p.y - a.y) < 0.75) return;
  const mid = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
  sctx.beginPath();
  sctx.moveTo(stroke.mid.x, stroke.mid.y);
  sctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
  sctx.stroke();
  stroke.last = p;
  stroke.mid = mid;
}
function shapeTo(p, shift) {
  if (!stroke) return;
  sctx.clearRect(0, 0, P.w, P.h);
  let x1 = stroke.start.x, y1 = stroke.start.y, x2 = p.x, y2 = p.y;
  if (shift) {
    if (S.tool === 'line') {
      const dx = x2 - x1, dy = y2 - y1;
      const ang = Math.atan2(dy, dx);
      const snapped = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      x2 = x1 + Math.cos(snapped) * len;
      y2 = y1 + Math.sin(snapped) * len;
    } else {
      const dx = x2 - x1, dy = y2 - y1;
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      x2 = x1 + (dx < 0 ? -m : m);
      y2 = y1 + (dy < 0 ? -m : m);
    }
  }
  sctx.beginPath();
  if (S.tool === 'line') {
    sctx.moveTo(x1, y1); sctx.lineTo(x2, y2); sctx.stroke();
  } else if (S.tool === 'rect') {
    const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
    if (S.fillShape) sctx.fillRect(rx, ry, rw, rh);
    sctx.strokeRect(rx, ry, rw, rh);
  } else if (S.tool === 'ellipse') {
    sctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    if (S.fillShape) sctx.fill();
    sctx.stroke();
  }
}
function endStroke() {
  if (!stroke) return;
  const cv = P.frames[S.cf].c[S.cl];
  const lc = rctx(cv);
  lc.save();
  lc.globalAlpha = S.opacity;
  if (S.tool === 'eraser') lc.globalCompositeOperation = 'destination-out';
  lc.drawImage(strokeBuf, 0, 0);
  lc.restore();
  const after = snapshotLayer(S.cf, S.cl);
  if (beforePix) pushPixelsCmd(S.cf, S.cl, beforePix, after);
  stroke = null; beforePix = null;
  render(); drawThumb(S.cf); scheduleAutosave();
}

function doFill(p) {
  const x = p.x | 0, y = p.y | 0;
  if (x < 0 || y < 0 || x >= P.w || y >= P.h) return;
  const cv = P.frames[S.cf].c[S.cl];
  const lc = rctx(cv);
  const before = snapshotLayer(S.cf, S.cl);
  const ok = floodFill(lc, x, y, S.color, S.tol);
  if (!ok) return;
  pushPixelsCmd(S.cf, S.cl, before, snapshotLayer(S.cf, S.cl));
  render(); drawThumb(S.cf); scheduleAutosave();
}
function floodFill(lc, x, y, hex, tol) {
  const w = P.w, h = P.h;
  const img = lc.getImageData(0, 0, w, h), d = img.data;
  const si = (y * w + x) * 4;
  const tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
  const fr = hexToRgb(hex);
  if (tr === fr[0] && tg === fr[1] && tb === fr[2] && ta === 255) return false;
  const th = 4 * tol * tol;
  const match = o => {
    const dr = d[o] - tr, dg = d[o + 1] - tg, db = d[o + 2] - tb, da = d[o + 3] - ta;
    return dr * dr + dg * dg + db * db + da * da <= th;
  };
  const seen = new Uint8Array(w * h);
  const stack = [x + y * w];
  while (stack.length) {
    let i = stack.pop();
    if (seen[i]) continue;
    const o0 = i * 4;
    if (!match(o0)) continue;
    const yi = (i / w) | 0;
    let x0 = i - yi * w, x1 = x0;
    while (x0 > 0 && !seen[yi * w + x0 - 1] && match((yi * w + x0 - 1) * 4)) x0--;
    while (x1 < w - 1 && !seen[yi * w + x1 + 1] && match((yi * w + x1 + 1) * 4)) x1++;
    for (let xx = x0; xx <= x1; xx++) {
      const ii = yi * w + xx;
      if (seen[ii]) continue;
      seen[ii] = 1;
      const oo = ii * 4;
      d[oo] = fr[0]; d[oo + 1] = fr[1]; d[oo + 2] = fr[2]; d[oo + 3] = 255;
      if (yi > 0) { const u = ii - w; if (!seen[u] && match(u * 4)) stack.push(u); }
      if (yi < h - 1) { const dn = ii + w; if (!seen[dn] && match(dn * 4)) stack.push(dn); }
    }
  }
  lc.putImageData(img, 0, 0);
  return true;
}

function pickColor(p) {
  tActx.clearRect(0, 0, P.w, P.h);
  compositeLayersTo(tActx, S.cf, { bg: true });
  const x = clamp(p.x | 0, 0, P.w - 1), y = clamp(p.y | 0, 0, P.h - 1);
  const d = tActx.getImageData(x, y, 1, 1).data;
  if (d[3] < 10) { toast('Nothing to pick here'); return; }
  setColor(rgbToHex(d[0], d[1], d[2]));
  setTool('brush');
}

/* lasso */
function lassoDown(p) {
  if (lasso && lasso.mode === 'move') {
    lasso.drag = { sx: p.x - lasso.dx, sy: p.y - lasso.dy };
    return;
  }
  lasso = { pts: [p], mode: 'draw', dx: 0, dy: 0 };
}
function lassoMove(p) {
  if (!lasso) return;
  if (lasso.mode === 'move') {
    if (!lasso.drag) return;
    lasso.dx = p.x - lasso.drag.sx;
    lasso.dy = p.y - lasso.drag.sy;
    render();
    return;
  }
  const lp = lasso.pts[lasso.pts.length - 1];
  if (Math.hypot(p.x - lp.x, p.y - lp.y) > 1.5) { lasso.pts.push(p); drawOverlay(); }
}
function lassoUp() {
  if (!lasso) return;
  if (lasso.mode === 'move') { lasso.drag = null; return; }
  if (lasso.pts.length < 3 || lassoArea(lasso.pts) < 12) { lasso = null; drawOverlay(); return; }
  lasso.before = snapshotLayer(S.cf, S.cl);
  mctx.clearRect(0, 0, P.w, P.h);
  pathPoly(mctx, lasso.pts);
  mctx.fillStyle = '#fff';
  mctx.fill();
  p2ctx.clearRect(0, 0, P.w, P.h);
  p2ctx.drawImage(P.frames[S.cf].c[S.cl], 0, 0);
  p2ctx.globalCompositeOperation = 'destination-in';
  p2ctx.drawImage(selMask, 0, 0);
  p2ctx.globalCompositeOperation = 'source-over';
  const lc = rctx(P.frames[S.cf].c[S.cl]);
  lc.save();
  lc.globalCompositeOperation = 'destination-out';
  lc.drawImage(selMask, 0, 0);
  lc.restore();
  lasso.mode = 'move';
  toast('Move the selection — Enter to apply, Esc to cancel', 3200);
  render(); drawOverlay();
}
function lassoArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}
function commitLasso() {
  if (!lasso || lasso.mode !== 'move') { lasso = null; drawOverlay(); return; }
  const lc = rctx(P.frames[S.cf].c[S.cl]);
  lc.drawImage(pieceBuf, Math.round(lasso.dx), Math.round(lasso.dy));
  const before = lasso.before;
  lasso = null;
  pushPixelsCmd(S.cf, S.cl, before, snapshotLayer(S.cf, S.cl));
  render(); drawThumb(S.cf); drawOverlay(); scheduleAutosave();
}
function cancelLasso() {
  if (!lasso) return;
  if (lasso.before) rctx(P.frames[S.cf].c[S.cl]).putImageData(lasso.before, 0, 0);
  lasso = null;
  render(); drawOverlay();
}

/* ---------- zoom / pan ---------- */
function applyZoom() {
  if (!P) return;
  disp.style.width = (P.w * S.zoom) + 'px';
  disp.style.height = (P.h * S.zoom) + 'px';
  disp.classList.toggle('pixelated', S.zoom >= 2.5);
  $('#zoomPct').textContent = Math.round(S.zoom * 100) + '%';
}
function fitZoom() {
  if (!P) return;
  const aw = stagewrap.clientWidth - 48, ah = stagewrap.clientHeight - 48;
  S.zoom = clamp(Math.min(aw / P.w, ah / P.h), 0.05, 2);
  S.autoFit = true;
  applyZoom();
  requestAnimationFrame(() => {
    stagewrap.scrollLeft = (stagewrap.scrollWidth - stagewrap.clientWidth) / 2;
    stagewrap.scrollTop = (stagewrap.scrollHeight - stagewrap.clientHeight) / 2;
  });
}
function zoomAt(cx, cy, factor) {
  const old = S.zoom;
  S.zoom = clamp(old * factor, 0.05, 8);
  if (S.zoom === old) return;
  const r1 = disp.getBoundingClientRect();
  const dx = cx - r1.left, dy = cy - r1.top;
  applyZoom();
  const r2 = disp.getBoundingClientRect();
  stagewrap.scrollLeft += (r2.left + dx * (S.zoom / old)) - cx;
  stagewrap.scrollTop += (r2.top + dy * (S.zoom / old)) - cy;
  S.autoFit = false;
}
stagewrap.addEventListener('wheel', e => {
  if (!P) return;
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0012));
}, { passive: false });

stagewrap.addEventListener('pointerdown', e => {
  if (!P || S.playing) return;
  if (e.button === 1 || (e.button === 0 && S.spaceHeld)) {
    e.preventDefault();
    pan = { x: e.clientX, y: e.clientY, sl: stagewrap.scrollLeft, st: stagewrap.scrollTop };
    stagewrap.classList.add('panning');
    stagewrap.setPointerCapture(e.pointerId);
  }
});
stagewrap.addEventListener('pointermove', e => {
  if (!pan) return;
  stagewrap.scrollLeft = pan.sl - (e.clientX - pan.x);
  stagewrap.scrollTop = pan.st - (e.clientY - pan.y);
});
const panEnd = () => { pan = null; stagewrap.classList.remove('panning'); };
stagewrap.addEventListener('pointerup', panEnd);
stagewrap.addEventListener('pointercancel', panEnd);
stagewrap.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { if (S.autoFit) fitZoom(); });

/* ---------- playback ---------- */
let rafId = 0, lastT = 0, acc = 0;
function togglePlay() { S.playing ? stopPlay() : startPlay(); }
function startPlay() {
  if (!P || S.playing) return;
  S.playing = true;
  $('#btnPlay').innerHTML = icon('pause');
  acc = 0; lastT = performance.now();
  if (S.audio) {
    try { S.audio.currentTime = Math.min(S.audio.duration || 0, S.cf / P.fps); S.audio.play().catch(() => { }); } catch (e) { }
  }
  rafId = requestAnimationFrame(tick);
}
function tick(now) {
  if (!S.playing) return;
  const spf = 1000 / P.fps;
  let dt = now - lastT; lastT = now;
  if (dt > 250) dt = 250;
  acc += dt;
  let moved = false;
  while (acc >= spf) {
    acc -= spf;
    if (S.cf < P.frames.length - 1) S.cf++;
    else if (S.loop) {
      S.cf = 0;
      if (S.audio) { try { S.audio.currentTime = 0; S.audio.play().catch(() => { }); } catch (e) { } }
    } else { stopPlay(); return; }
    moved = true;
  }
  if (moved) { render(); updateCounter(); scrollStripTo(S.cf); }
  rafId = requestAnimationFrame(tick);
}
function stopPlay() {
  if (!S.playing) return;
  S.playing = false;
  cancelAnimationFrame(rafId);
  if (S.audio) S.audio.pause();
  $('#btnPlay').innerHTML = icon('play');
  render();
  updateStripSelection();
}
function setFps(v) {
  P.fps = clamp(v | 0, 1, 60);
  $('#fpsVal').textContent = P.fps;
  scheduleAutosave();
}

/* ---------- modals ---------- */
function anyModalOpen() {
  return $$('#modalRoot .overlay').some(o => !o.hidden);
}
function openModal(id) { $('#' + id).hidden = false; }
function closeModal(id) { $('#' + id).hidden = true; }
$$('#modalRoot .overlay').forEach(o => {
  o.addEventListener('pointerdown', e => {
    if (e.target === o && !(o.id === 'mNew' && !P)) o.hidden = true;
  });
});

/* ---------- audio ---------- */
$('#btnAudio').onclick = () => $('#fileAudio').click();
$('#fileAudio').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (S.audio) { try { S.audio.pause(); } catch (err) { } }
  S.audio = new Audio(URL.createObjectURL(f));
  toast('Audio loaded — it plays with preview (not saved in project files)');
});

/* ---------- keyboard ---------- */
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if (!P) return;
  if (anyModalOpen()) {
    if (e.key === 'Escape') $$('#modalRoot .overlay').forEach(o => { if (!(o.id === 'mNew' && !P)) o.hidden = true; });
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!S.spaceHeld && !S.playing) { /* first press also toggles play */ }
    togglePlay();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'b': setTool('brush'); break;
    case 'e': setTool('eraser'); break;
    case 'g': setTool('fill'); break;
    case 'l': setTool('lasso'); break;
    case 'v': setTool('line'); break;
    case 'r': setTool('rect'); break;
    case 'c': setTool('ellipse'); break;
    case 'i': setTool('picker'); break;
    case 'o': S.onion = !S.onion; $('#btnOnion').classList.toggle('on', S.onion); render(); break;
    case 'n': addFrame(false); break;
    case 'd': addFrame(true); break;
    case 'delete': case 'backspace': delFrame(S.cf); break;
    case 'arrowleft': case ',': e.preventDefault(); setCurFrame(S.cf - 1); break;
    case 'arrowright': case '.': e.preventDefault(); setCurFrame(S.cf + 1); break;
    case 'home': setCurFrame(0); break;
    case 'end': setCurFrame(P.frames.length - 1); break;
    case '[': setSize(S.size - (S.size > 12 ? 4 : 1)); break;
    case ']': setSize(S.size + (S.size >= 12 ? 4 : 1)); break;
    case 'enter': commitLasso(); break;
    case 'escape': cancelLasso(); break;
  }
});

/* ---------- autosave ---------- */
let autoTimer = 0;
function scheduleAutosave() {
  if (S.autosaveOff || !P) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(flushAutosave, 2000);
}
function flushAutosave() {
  if (S.autosaveOff || !P) return;
  try {
    localStorage.setItem(AUTO_KEY, serializeProject());
  } catch (err) {
    S.autosaveOff = true;
    toast('Project too large for browser autosave — use Save to keep a backup file', 5200);
  }
}
window.addEventListener('beforeunload', flushAutosave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushAutosave(); });

/* ---------- settings / top bar ---------- */
function syncSettingsModal() {
  $('#stName').value = P.name;
  $('#stBg').value = P.bg;
  const sel = $('#stFps');
  const opts = Array.from(sel.options).map(o => o.value);
  if (!opts.includes(String(P.fps))) {
    const o = document.createElement('option');
    o.textContent = P.fps;
    sel.appendChild(o);
  }
  sel.value = String(P.fps);
}

function bindCoreEvents() {
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;
  $('#btnOnion').onclick = () => { S.onion = !S.onion; $('#btnOnion').classList.toggle('on', S.onion); render(); };
  $('#btnGrid').onclick = () => { S.grid = !S.grid; $('#btnGrid').classList.toggle('on', S.grid); render(); };
  $('#btnLoop').onclick = () => { S.loop = !S.loop; $('#btnLoop').classList.toggle('on', S.loop); };
  $('#btnPlay').onclick = togglePlay;
  $('#btnStart').onclick = () => setCurFrame(0);
  $('#btnEnd').onclick = () => setCurFrame(P.frames.length - 1);
  $('#btnPrev').onclick = () => setCurFrame(S.cf - 1);
  $('#btnNext').onclick = () => setCurFrame(S.cf + 1);
  $('#fpsMinus').onclick = () => setFps(P.fps - 1);
  $('#fpsPlus').onclick = () => setFps(P.fps + 1);

  $$('#toolbar .tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('#colorSwatch').addEventListener('input', e => setColor(e.target.value));
  $('#sizeRange').addEventListener('input', e => setSize(+e.target.value));
  $('#opacityRange').addEventListener('input', e => {
    S.opacity = (+e.target.value) / 100;
    $('#opacityVal').textContent = e.target.value + '%';
    drawOverlay();
  });
  $('#tolRange').addEventListener('input', e => {
    S.tol = +e.target.value;
    $('#tolVal').textContent = 'tol ' + S.tol;
  });
  $('#fillShape').addEventListener('change', e => S.fillShape = e.target.checked);

  $('#projName').addEventListener('change', e => {
    P.name = e.target.value.trim() || 'Untitled';
    e.target.value = P.name;
    scheduleAutosave();
  });

  $('#layerAdd').onclick = addLayer;
  $('#layerDel').onclick = delLayer;
  $('#layerUp').onclick = () => moveLayer(S.cl, S.cl + 1);
  $('#layerDown').onclick = () => moveLayer(S.cl, S.cl - 1);
  $('#layerClear').onclick = clearLayer;
  $('#layerOpacity').addEventListener('input', e => {
    const L = P.layers[S.cl];
    L.opacity = (+e.target.value) / 100;
    $('#layerOpacityVal').textContent = e.target.value + '%';
    render(); drawThumb(S.cf);
  });
  $('#layerOpacity').addEventListener('change', () => {
    scheduleAutosave();
  });

  $('#zoomIn').onclick = () => { zoomAt(stagewrap.clientWidth / 2 + stagewrap.getBoundingClientRect().left, stagewrap.clientHeight / 2 + stagewrap.getBoundingClientRect().top, 1.25); };
  $('#zoomOut').onclick = () => { zoomAt(stagewrap.clientWidth / 2 + stagewrap.getBoundingClientRect().left, stagewrap.clientHeight / 2 + stagewrap.getBoundingClientRect().top, 0.8); };
  $('#zoomFit').onclick = fitZoom;

  $('#btnNew').onclick = () => {
    $('#npCancel').hidden = false;
    openModal('mNew');
  };
  $('#npCancel').onclick = () => closeModal('mNew');
  $('#npCreate').onclick = () => {
    const [w, h] = $('#npSize').value.split('x').map(Number);
    createProject($('#npName').value.trim() || 'My Animation', w, h, +$('#npFps').value, $('#npBg').value);
    closeModal('mNew');
    setProject(P);
  };
  $('#npRestore').onclick = async () => {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      await loadProjectJSON(raw);
      closeModal('mNew');
      toast('Previous session restored');
    } catch (err) {
      toast('Could not restore: ' + err.message);
    }
  };

  $('#btnSettings').onclick = () => { syncSettingsModal(); openModal('mSettings'); };
  $('#stDone').onclick = () => {
    P.name = $('#stName').value.trim() || P.name;
    $('#projName').value = P.name;
    setFps(+$('#stFps').value);
    P.bg = $('#stBg').value;
    render(); drawAllThumbs(); scheduleAutosave();
    closeModal('mSettings');
  };

  $('#btnSaveProj').onclick = saveProjectFile;
  $('#btnOpen').onclick = () => $('#fileOpen').click();
  $('#fileOpen').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      await loadProjectJSON(await f.text());
      toast('Project loaded');
    } catch (err) {
      toast('Could not open: ' + err.message);
    }
  });

  $('#btnExport').onclick = () => { stopPlay(); openExport(); };
}

/* ---------- boot ---------- */
function boot() {
  try {
    mountIcons();
    buildPalette();
    bindCoreEvents();
    bindExportEvents();
    let hasAuto = false;
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        hasAuto = !!(o && Array.isArray(o.frames) && o.frames.length);
      }
    } catch (err) { }
    $('#npRestore').hidden = !hasAuto;
    $('#npCancel').hidden = true;
    openModal('mNew');
  } catch (err) {
    toast('Startup error: ' + err.message, 10000);
    console.error(err);
  }
}
boot();
