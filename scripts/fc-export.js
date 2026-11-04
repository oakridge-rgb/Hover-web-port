/* ============================================================
   FlipaClip Studio — export & project files
   ============================================================ */
'use strict';

const evenDim = v => Math.max(2, 2 * Math.round(v / 2));
function safeName() {
  return (P.name || 'animation').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'animation';
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}

/* ---------- project serialization ---------- */
function serializeProject() {
  return JSON.stringify({
    app: 'flipaclip-clone',
    version: 1,
    name: P.name, w: P.w, h: P.h, fps: P.fps, bg: P.bg,
    layers: P.layers.map(l => ({ name: l.name, visible: l.visible, opacity: l.opacity })),
    frames: P.frames.map(f => f.c.map(cv => cv.toDataURL('image/png'))),
  });
}
async function loadProjectJSON(txt) {
  const o = JSON.parse(txt);
  if (!o || o.app !== 'flipaclip-clone' || !Array.isArray(o.frames) || !o.frames.length || !o.w)
    throw new Error('not a FlipaClip Studio project file');
  const np = {
    name: String(o.name || 'Animation'),
    w: o.w | 0, h: o.h | 0,
    fps: clamp(o.fps || 12, 1, 60),
    bg: o.bg || '#ffffff',
    layers: (Array.isArray(o.layers) && o.layers.length ? o.layers : [{ name: 'Layer 1', visible: true, opacity: 1 }])
      .map(l => ({ id: uid(), name: String(l.name || 'Layer'), visible: l.visible !== false, opacity: clamp(+l.opacity || 1, 0, 1) })),
    frames: [],
  };
  const imgRows = o.frames.map(row => (Array.isArray(row) ? row : []).map(src => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = String(src);
  })));
  const flat = await Promise.all(imgRows.flat());
  let k = 0;
  for (const row of imgRows) {
    const imgs = [];
    for (let i = 0; i < row.length; i++) imgs.push(flat[k++]);
    np.frames.push({
      id: uid(),
      c: np.layers.map((L, li) => {
        const cv = mkCanvas(np.w, np.h);
        const im = imgs[li];
        if (im) pctx(cv).drawImage(im, 0, 0, np.w, np.h);
        return cv;
      }),
    });
  }
  closeModal('mNew');
  setProject(np);
}
function saveProjectFile() {
  flushAutosave();
  const blob = new Blob([serializeProject()], { type: 'application/json' });
  downloadBlob(blob, safeName() + '.flipaclip.json');
  toast('Project saved — open it later with Open');
}

/* ---------- export modal ---------- */
let exFmt = 'gif';
let exBusy = false;
let exAbort = false;

function openExport() {
  if (!P) return;
  if (exBusy) return;
  const sel = $('#exFps');
  sel.innerHTML = '';
  [8, 12, 15, 24, 30, 60].forEach(v => {
    const o = document.createElement('option');
    o.value = String(v); o.textContent = v + ' fps';
    if (v === P.fps) o.selected = true;
    sel.appendChild(o);
  });
  if (!Array.from(sel.options).some(o => o.selected)) sel.value = String(P.fps);
  $('#exProgWrap').hidden = true;
  $('#exProg').style.width = '0%';
  $('#exStatus').textContent = '';
  $('#exGo').disabled = false;
  $('#exCancel').textContent = 'Cancel';
  updateExInfo();
  openModal('mExport');
}
function updateExInfo() {
  const scale = parseFloat($('#exScale').value);
  const w = evenDim(P.w * scale), h = evenDim(P.h * scale);
  const fps = +$('#exFps').value || P.fps;
  const dur = (P.frames.length / fps).toFixed(1);
  let txt = P.frames.length + ' frames · ' + dur + ' s · ' + w + ' × ' + h + ' px';
  if (exFmt === 'mp4') {
    const m = pickVideoMime();
    txt += ' — ' + (m && m.startsWith('video/mp4') ? 'records MP4 in this browser (real time)'
      : m ? 'this browser records WebM (MP4 not supported here)' : 'video recording not supported');
  }
  if (exFmt === 'gif') txt += ' — GIF animates forever, optimized palette';
  if (exFmt === 'png') txt += ' — one transparent-ready PNG per frame';
  $('#exInfo').textContent = txt;
}
function setProgress(frac, label) {
  $('#exProg').style.width = Math.round(frac * 100) + '%';
  if (label !== undefined) $('#exStatus').textContent = label;
}

function pickVideoMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const cands = [
    'video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm',
  ];
  for (const m of cands) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { }
  }
  return null;
}

function drawExportFrame(cx, w, h, fi) {
  tActx.clearRect(0, 0, P.w, P.h);
  compositeLayersTo(tActx, fi, { bg: true });
  cx.clearRect(0, 0, w, h);
  cx.drawImage(tmpA, 0, 0, w, h);
}

async function exportGIF(scale, fps) {
  const w = evenDim(P.w * scale), h = evenDim(P.h * scale);
  const c = mkCanvas(w, h);
  const cx = rctx(c);
  const frames = [];
  const n = P.frames.length;
  for (let i = 0; i < n; i++) {
    if (exAbort) throw new Error('cancelled');
    drawExportFrame(cx, w, h, i);
    const id = cx.getImageData(0, 0, w, h);
    const pal = FCGIF.medianCutPalette(id.data, w, h, 256);
    const idx = FCGIF.indexMap(id.data, w, h, pal);
    frames.push({ palette: pal, pixels: idx });
    setProgress((i + 1) / n * 0.9, 'Encoding frame ' + (i + 1) + '/' + n + '…');
    await new Promise(r => setTimeout(r, 0));
  }
  setProgress(0.95, 'Building GIF file…');
  await new Promise(r => setTimeout(r, 0));
  const delay = Math.max(2, Math.round(100 / fps));
  const bytes = FCGIF.buildGIF(frames, w, h, delay, 0);
  downloadBlob(new Blob([bytes], { type: 'image/gif' }), safeName() + '.gif');
  setProgress(1, 'Done — GIF saved');
}

async function exportVideo(scale, fps) {
  const mime = pickVideoMime();
  if (!mime) throw new Error('this browser does not support video recording');
  const w = evenDim(P.w * scale), h = evenDim(P.h * scale);
  const c = mkCanvas(w, h);
  const cx = pctx(c);
  const n = P.frames.length;
  const stream = c.captureStream(fps);
  const bitrate = clamp(Math.round(w * h * fps * 0.18), 1500000, 16000000);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = res; });
  drawExportFrame(cx, w, h, 0);
  rec.start();
  const total = n * 1000 / fps;
  await new Promise(res => {
    const t0 = performance.now();
    function loop(now) {
      if (exAbort) { res(); return; }
      const t = now - t0;
      const fi = Math.min(n - 1, Math.floor(t / (1000 / fps)));
      drawExportFrame(cx, w, h, fi);
      setProgress(Math.min(0.95, t / total), 'Recording ' + Math.min(n, fi + 1) + '/' + n + ' (real time)…');
      if (t >= total + 120) { res(); return; }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach(t => t.stop());
  if (exAbort) throw new Error('cancelled');
  const isMp4 = mime.startsWith('video/mp4');
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  downloadBlob(blob, safeName() + (isMp4 ? '.mp4' : '.webm'));
  setProgress(1, 'Done — ' + (isMp4 ? 'MP4' : 'WebM') + ' saved');
  if (!isMp4) toast('This browser cannot record MP4 — saved as WebM instead (plays in most players)', 5200);
}

async function exportPNGs(scale) {
  const w = evenDim(P.w * scale), h = evenDim(P.h * scale);
  const c = mkCanvas(w, h);
  const cx = pctx(c);
  const files = [];
  const n = P.frames.length;
  for (let i = 0; i < n; i++) {
    if (exAbort) throw new Error('cancelled');
    drawExportFrame(cx, w, h, i);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    files.push({ name: 'frame_' + String(i + 1).padStart(4, '0') + '.png', data: bytes });
    setProgress((i + 1) / n * 0.9, 'Rendering frame ' + (i + 1) + '/' + n + '…');
  }
  setProgress(0.95, 'Packing ZIP…');
  await new Promise(r => setTimeout(r, 0));
  downloadBlob(FCZIP.makeZip(files), safeName() + '_frames.zip');
  setProgress(1, 'Done — ZIP saved');
}

function bindExportEvents() {
  $$('#mExport .excard').forEach(card => {
    card.onclick = () => {
      if (exBusy) return;
      exFmt = card.dataset.fmt;
      $$('#mExport .excard').forEach(c => c.classList.toggle('on', c === card));
      $('#exFpsRow').hidden = exFmt === 'png';
      updateExInfo();
    };
  });
  $('#exScale').addEventListener('change', updateExInfo);
  $('#exFps').addEventListener('change', updateExInfo);
  $('#exCancel').onclick = () => {
    if (exBusy) { exAbort = true; $('#exStatus').textContent = 'Cancelling…'; }
    else closeModal('mExport');
  };
  $('#exGo').onclick = async () => {
    if (exBusy) return;
    exBusy = true;
    exAbort = false;
    $('#exGo').disabled = true;
    $('#exProgWrap').hidden = false;
    const scale = parseFloat($('#exScale').value);
    const fps = +$('#exFps').value || P.fps;
    try {
      if (exFmt === 'gif') await exportGIF(scale, fps);
      else if (exFmt === 'mp4') await exportVideo(scale, fps);
      else await exportPNGs(scale);
    } catch (err) {
      console.error(err);
      setProgress(0, '');
      $('#exStatus').textContent = err.message === 'cancelled' ? 'Cancelled' : 'Failed: ' + err.message;
    } finally {
      exBusy = false;
      $('#exGo').disabled = false;
      $('#exCancel').textContent = 'Close';
    }
  };
}
