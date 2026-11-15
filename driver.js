/* Hover! (1995) web host driver.
 * Runs the original game (statically recompiled to WebAssembly) in the
 * browser: canvas blit of the game's 8-bit window surface, keyboard/mouse/
 * touch input into the Win32 message pump, WebAudio playback of waveOut
 * buffers and sndPlaySound, a small GM-ish synthesizer for the midiStream
 * music, and localStorage-backed registry persistence. */
"use strict";

let Module = {
  preRun: [],
  canvas: null,
  print: s => console.log(s),
  printErr: s => console.warn(s),
  setStatus: s => { if (s) console.log(s); },
  totalDependencies: 0,
  monitorRunDependencies() {}
};

/* ------------------------------------------------ audio (waveOut) */
const HoverWave = {
  ctx: null, fmt: null, nextTime: 0, queue: [],
  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  open() { this.ensure(); },
  reset() { this.queue = []; this.nextTime = this.ctx ? this.ctx.currentTime : 0; },
  /* WAVEFORMATEX captured by the shim: tag, channels, rate, bits */
  fmtSet(tag, ch, rate, bits) { this.fmt = { tag, ch, rate, bits }; this.reset(); },
  write(ptr, len) {
    if (!this.fmt || !len) return;
    const ctx = this.ensure();
    const bytes = Module.HEAPU8.subarray(ptr, ptr + len);
    let f32;
    if (this.fmt.bits === 16 && (this.fmt.tag === 1 || this.fmt.tag === 3)) {
      const n = len >> 1;
      const view = new Int16Array(len / 2);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, len);
      for (let i = 0; i < n; i++) view[i] = dv.getInt16(i * 2, true);
      f32 = new Float32Array(n);
      for (let i = 0; i < n; i++) f32[i] = view[i] / 32768;
    } else if (this.fmt.bits === 8) {
      f32 = new Float32Array(len);
      for (let i = 0; i < len; i++) f32[i] = (bytes[i] - 128) / 128;
    } else return;
    const dur = f32.length / (this.fmt.rate * this.fmt.ch);
    if (dur <= 0) return;
    const buf = ctx.createBuffer(this.fmt.ch, f32.length / this.fmt.ch, this.fmt.rate);
    for (let c = 0; c < this.fmt.ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = f32[i * this.fmt.ch + c];
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const now = ctx.currentTime;
    if (this.nextTime < now + 0.02) this.nextTime = now + 0.02;
    src.connect(ctx.destination);
    src.start(this.nextTime);
    this.nextTime += dur;
    if (this.queue.length > 64) { this.reset(); }
    else this.queue.push(src);
  },
  /* sndPlaySoundA: a file name in guest memory, SND_MEMORY = WAV bytes */
  sndPlay(ptr, flags) {
    if (!ptr) return;
    const ctx = this.ensure();
    const SND_MEMORY = 4;
    if (!(flags & SND_MEMORY)) return;           /* file names: not wired (unused by Hover) */
    try { ctx.decodeAudioData(Module.HEAPU8.slice(ptr, ptr + 65536).buffer).catch(() => {}); } catch (e) {}
  }
};
window.HoverWave = HoverWave;

/* ------------------------------------------------ music (midiStream) */
const HoverMidi = {
  ctx: null, master: null, seq: [], running: false, startAt: 0,
  progs: new Array(16).fill(0), tempo: 500000, ppq: 96, pending: null,
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  open() { this.ensure(); this.reset(); },
  reset() {
    this.seq = [];
    this.pending = null;
    this.running = false;
    this.progs.fill(0);
    this.tempo = 500000;
    for (const v of Object.values(this.voices || {})) { try { v.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); v.o.stop(this.ctx.currentTime + 0.1); } catch (e) {} }
    this.voices = {};
  },
  voices: {},
  /* stream format: repeat { u32 delta, u32 event } — delta in stream ticks */
  stream(ptr, len) {
    const dv = new DataView(Module.HEAPU8.buffer, Module.HEAPU8.byteOffset + ptr, len);
    const n = len >> 2;
    let t = this.pending ? this.pending.t : 0;
    let idx = this.pending ? this.pending.idx : 0;
    for (; idx + 2 <= n; idx += 2) {
      const delta = dv.getUint32(idx * 4, true);
      const ev = dv.getUint32((idx + 1) * 4, true);
      if ((ev & 0x80000000) || !(ev & 0x80000000) && (ev >>> 24) !== 0) {
        /* MIDI stream event format: status in bits 31..24? In MIDIEVENT dwEvent:
           high bit =_TEMPO flag... standard: if (dwEvent & 0x80000000) it is
           special (TEMPO encoded); else status byte = dwEvent & 0xFF etc. */
      }
      t += delta;
      if (ev & 0x80000000) {
        if (((ev >> 8) & 0xFFFFFF) === 0x000000) { /* METSVC tempo: dwEvent = 0x80000000 | length | ... */
          /* MEVT_TEMPO: (ev & 0x7FFF0000) >> 8? actual: tempo in dwEvent & 0x7FFFFF << ... */
          this.tempo = (ev >> 8) & 0xFFFFFF;
        }
        continue;
      }
      const st = ev & 0xFF, d1 = (ev >> 8) & 0xFF, d2 = (ev >> 16) & 0xFF;
      if (!st) continue;
      const type = st & 0xF0, ch = st & 0x0F;
      const sec = t * this.tempo / (this.ppq * 1e6);
      if (type === 0x90 && d2) this.seq.push({ sec, on: 1, ch, note: d1, vel: d2 });
      else if (type === 0x80 || (type === 0x90 && !d2)) this.seq.push({ sec, on: 0, ch, note: d1 });
      else if (type === 0xC0) this.seq.push({ sec, on: 2, ch, prog: d1 });
      else if (type === 0xB0 && d1 === 7) this.seq.push({ sec, on: 3, ch, vol: d2 });
    }
    this.pending = { t, idx };
    if (!this.running && this.seq.length) this.play();
  },
  short(msg) { /* hardware-style short messages if used */
    const st = msg & 0xFF, d1 = (msg >> 8) & 0xFF, d2 = (msg >> 16) & 0xFF;
    const type = st & 0xF0, ch = st & 0x0F;
    if (type === 0x90 && d2) this.note(ch, d1, d2, 0);
    else if (type === 0x80 || (type === 0x90 && !d2)) this.noteOff(ch, d1, 0);
    else if (type === 0xC0) this.progs[ch] = d1;
  },
  play() {
    this.running = true;
    const ctx = this.ensure();
    this.startAt = ctx.currentTime + 0.05;
    const seq = this.seq;
    for (const e of seq) {
      const when = this.startAt + e.sec;
      if (when < ctx.currentTime - 0.05) continue;
      if (e.on === 1) this.note(e.ch, e.note, e.vel, when);
      else if (e.on === 0) this.noteOff(e.ch, e.note, when);
      else if (e.on === 2) this.progs[e.ch] = e.prog;
      else if (e.on === 3 && this.master) this.master.gain.value = 0.35 * e.vol / 127;
    }
  },
  oscFor(prog) {
    if (prog === 11 || prog === 46 || prog === 48 || prog === 49 || prog === 52) return "sine";
    if (prog === 30 || prog === 32 || prog === 33 || prog === 34 || prog === 39) return "square";
    if (prog >= 24 && prog <= 39) return "sawtooth";
    return "triangle";
  },
  note(ch, n, vel, when) {
    const ctx = this.ensure();
    const key = ch + ":" + n;
    this.noteOff(ch, n, when);
    const prog = this.progs[ch];
    const o = ctx.createOscillator();
    o.type = this.oscFor(prog);
    o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
    const g = ctx.createGain();
    g.gain.value = 0;
    const t = when || ctx.currentTime;
    const amp = 0.22 * (vel / 127) * (ch === 9 ? 0.8 : 1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.01);
    if (ch === 9) g.gain.setTargetAtTime(0.0001, t + 0.02, 0.06);
    o.connect(g); g.connect(this.master);
    o.start(t);
    this.voices[key] = { o, g, t };
  },
  noteOff(ch, n, when) {
    const key = ch + ":" + n;
    const v = this.voices[key];
    if (!v) return;
    const ctx = this.ensure();
    const t = when || ctx.currentTime;
    if (ch !== 9) v.g.gain.setTargetAtTime(0.0001, t, 0.08);
    v.o.stop(t + 0.6);
    delete this.voices[key];
  }
};
window.HoverMidi = HoverMidi;

/* ------------------------------------------------ driver */
const HW = { ready: false, running: false, palette: null, scratch: 0, img: null, dirty: true };

function blit() {
  if (!HW.ready) return;
  const ptr = Module._hw_screen_ptr();
  if (!ptr) return;
  Module._hw_palette(HW.scratch);
  const pal = new Uint32Array(Module.HEAPU32.buffer, HW.scratch, 256);
  const surf = new Uint8Array(Module.HEAPU8.buffer, ptr, 800 * 600);
  const px = HW.img.data;                     // Uint8ClampedArray RGBA
  const v = new Uint32Array(px.buffer);
  for (let i = 0; i < 800 * 600; i++) v[i] = pal[surf[i]];
  HW.img.dirty = true;
  HW.ctx.putImageData(HW.img, 0, 0);
}

function frame() {
  if (!HW.ready) return;
  try { Module._hw_frame(); } catch (e) {}
  if (HW.dirty || Module._hw_presented()) { blit(); HW.dirty = false; }
  requestAnimationFrame(frame);
}

async function start() {
  const canvas = document.getElementById("screen");
  canvas.width = 800; canvas.height = 600;
  HW.ctx = canvas.getContext("2d", { alpha: false });
  HW.img = HW.ctx.createImageData(800, 600);
  const v = new Uint32Array(HW.img.data.buffer);
  v.fill(0xFF000000);

  /* registry persistence */
  try {
    const reg = localStorage.getItem("hover.reg") || "";
    Module.FS.writeFile("/c/HOVER/hover.reg", reg, { encoding: "binary" });
  } catch (e) {}
  Module.FS.mkdirTree("/c/HOVER");

  /* the game opens Sounds\Mixed\... (mixed case); the data ships as SOUNDS/MIXED */
  function aliasTree(dir, alias) {
    try {
      const entries = Module.FS.readdir(dir).filter(e => e[0] !== ".");
      Module.FS.mkdirTree(alias);
      for (const e of entries) {
        const st = Module.FS.stat(dir + "/" + e);
        if (Module.FS.isDir(st.mode)) aliasTree(dir + "/" + e, alias + "/" + e);
        else Module.FS.writeFile(alias + "/" + e, Module.FS.readFile(dir + "/" + e));
      }
    } catch (e) {}
  }
  aliasTree("/c/HOVER/SOUNDS", "/c/HOVER/Sounds");

  HW.scratch = Module._malloc(1024);
  HW.ready = true;
  document.getElementById("bootmsg").textContent = "";
  const rc = Module._hw_boot();
  console.log("hw_boot ->", rc);
  if (rc !== 0) {
    document.getElementById("bootmsg").textContent = "boot failed (" + rc + ") — see console";
    return;
  }
  Module._hw_dashres();
  frame();
  try {
    await Module._hw_run();                    /* asyncified: yields on blocking calls */
  } catch (e) { console.error("hw_run:", e); }
}

/* ------------------------------------------------ input */
const VK = {
  Up: 0x26, Down: 0x28, Left: 0x25, Right: 0x27,
  Enter: 0x0D, Space: 0x20, Escape: 0x1B, Tab: 0x09,
  Shift: 0x10, Control: 0x11, Alt: 0x12, Backspace: 0x08
};
for (let i = 65; i <= 90; i++) VK[String.fromCharCode(i)] = i;
for (let i = 48; i <= 57; i++) VK[String.fromCharCode(i)] = i;
VK.F1 = 0x70; VK.F2 = 0x71; VK.F3 = 0x72; VK.F4 = 0x73; VK.F5 = 0x74;

function sendKey(down, e) {
  if (!HW.ready) return;
  let vk = VK[e.key];
  if (vk === undefined) {
    if (e.key.length === 1) vk = e.key.toUpperCase().charCodeAt(0);
    else return;
  }
  Module._hw_key(down, vk, 0);
  if (down && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    /* WM_CHAR */
    Module.ccall("hw_char", null, ["number"], [e.key.charCodeAt(0)]);
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab", "F1", "F2", "F3", "F4", "F5"].includes(e.key) || e.key === "Enter" || e.key === "Escape")
    e.preventDefault();
}

/* ------------------------------------------------ boot */
window.Module = Module;
Module.onRuntimeInitialized = () => { start(); };
