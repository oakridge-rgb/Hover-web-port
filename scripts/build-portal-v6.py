#!/usr/bin/env python3
# build-portal-v6.py — v5 -> v6 "wisp lane" upgrade
# Adds: real wisp (WLSP) handshake sweep, curl-transport over wisp tunnel,
#       stratus API through the tunnel, signaling WS via transport, UI panel.
# Run:  python3 scripts/build-portal-v6.py
import re, sys

SRC = "/home/z/my-project/download/test-v5-smart-player.html"
DST = "/home/z/my-project/download/test-v6-wisp-lane.html"

html = open(SRC, encoding="utf-8").read()
orig_len = len(html)

def must_replace(old, new, label):
    global html
    if old not in html:
        print(f"FAIL: anchor not found for [{label}]")
        sys.exit(1)
    if html.count(old) != 1:
        print(f"FAIL: anchor not unique for [{label}] ({html.count(old)} hits)")
        sys.exit(1)
    html = html.replace(old, new)
    print(f"ok: {label}")

# ---------------------------------------------------------------- engine code
ENGINE = r"""
/* ===== FATE PORTAL v6 WISP LANE ENGINE ===== */
console.log('%c[FATE PORTAL v6] wisp lane engine loaded', 'color:#a78bfa;font-weight:bold;');

const FATE_WISP_SERVERS = [
  'cdn.northstreetumc.org','cdn.vipersfutbol.com','cdn.pcesc.org','cdn.kcchallengevbc.com',
  'cdn.slcbmooc.org','cdn.topstargym.net','cdn.goaplytexas.org','cdn.clearfieldswimming.com',
  'cdn.richardacademy.cfd','wss://athollcottage.com/connection/','wss://api.personalloanonline.net/ws/'
];
const FATE_ASSET_BASES = [
  'https://cdn.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://quantil.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://fastly.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://testingcf.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://gcore.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://originfastly.jsdelivr.net/gh/%54ongSherbet/storage@main/',
  'https://cdn.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://fastly.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://gcore.jsdelivr.net/gh/TongSherbet/storage@main/',
  'https://cdn.statically.io/gh/TongSherbet/storage/main/',
  'https://rawcdn.githack.com/TongSherbet/storage/main/',
  'https://raw.githack.com/TongSherbet/storage/main/',
  'https://raw.githubusercontent.com/TongSherbet/storage/main/',
  'https://cdn.staticdeliver.com/gh/TongSherbet/storage@main/'
];
const FATE_WISP_LANE_KEY = 'fate_wisp_lane_v6';
const FATE_STRATUS_CUSTOM_BASE_KEY = 'fate_stratus_base_v6';

window.FATE_WISP_RESULTS = [];

function fateWispUrl(s){ return s.includes('://') ? s : ('wss://' + s + '/'); }

/* exact port of the working portal's testWlspDomain() — binary wisp handshake */
function fateTestWlsp(server, timeoutMs){
  return new Promise(resolve => {
    let ws;
    try{ ws = new WebSocket(fateWispUrl(server)); }catch(e){ return resolve(null); }
    ws.binaryType = 'arraybuffer';
    const id = (Math.floor(4294967294 * Math.random()) + 1) >>> 0;
    let gotEcho = false, t0 = 0;
    const finish = v => {
      clearTimeout(timer);
      try{ ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); }catch(e){}
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs || 4500);
    ws.onerror = () => finish(null);
    ws.onclose = () => { if(!gotEcho) finish(null); };
    ws.onmessage = evt => {
      const d = evt.data;
      if(!(d instanceof ArrayBuffer) || d.byteLength < 5) return finish(null);
      const dv = new DataView(d);
      const type = dv.getUint8(0), sid = dv.getUint32(1, true);
      if(gotEcho){ if(sid === id) finish(Math.round(performance.now() - t0)); return; }
      if(sid === 0){
        if(type === 5) ws.send(new Uint8Array([5,0,0,0,0,2,1]));
        else if(type === 3){
          const host = '127.0.0.1';
          const hb = new TextEncoder().encode(host);
          const frame = new Uint8Array([1,0,0,0,0,1,69,0,...hb]);
          new DataView(frame.buffer).setUint32(1, id, true);
          gotEcho = true; t0 = performance.now();
          try{ ws.send(frame); }catch(e){ return finish(null); }
        }
      }
    };
  });
}

async function fateWispSweep(){
  const cached = _lsGet(FATE_WISP_LANE_KEY);
  if(cached && cached.url && Date.now() - cached.t < 10 * 60 * 1000){
    window.wlspServer = cached.url; /* trust briefly; still re-verify below */
  }
  const probes = FATE_WISP_SERVERS.map(async s => ({ server: s, rtt: await fateTestWlsp(s, 4500) }));
  window.FATE_WISP_RESULTS = await Promise.all(probes);
  const alive = window.FATE_WISP_RESULTS.filter(r => r.rtt !== null).sort((a, b) => a.rtt - b.rtt);
  if(alive.length){
    window.wlspServer = fateWispUrl(alive[0].server);
    window.WlspPing = alive[0].rtt;
    window.WlspIsBackup = alive[0].server.includes('://');
    _lsSet(FATE_WISP_LANE_KEY, { url: window.wlspServer, t: Date.now() });
  }
  return window.FATE_WISP_RESULTS;
}

/* curl-transport (libcurl-wasm) over the winning wisp lane */
async function fateLoadTransport(){
  if(window.FATE_TRANSPORT) return window.FATE_TRANSPORT;
  if(!window.wlspServer || !window.FATE_WISP_RESULTS.some(r => r.rtt !== null)) await fateWispSweep();
  if(!window.wlspServer) return null;
  for(const base of FATE_ASSET_BASES){
    try{
      const mod = await import(base + 'curl/index.mjs');
      const C = mod.default || mod.LibcurlClient;
      if(!C) continue;
      const t = new C({ wisp: window.wlspServer });
      await t.init();
      window.FATE_TRANSPORT = t;
      window.FATE_ASSETS_BASE_USED = base;
      console.log('[FATE v6] wisp transport READY - lane', window.wlspServer, '- assets', base);
      return t;
    }catch(e){ console.warn('[FATE v6] transport base failed:', base, (e && e.message) || e); }
  }
  console.warn('[FATE v6] no asset base could serve curl/index.mjs');
  return null;
}

/* stratus API over the tunnel. Returns the same shape as stratusFetch(). */
async function stratusFetchWisp(host, path, ms, method, body){
  const t = window.FATE_TRANSPORT;
  if(!t) return { error: 'transport not ready' };
  const url = 'https://' + host + '/stratus/' + path;
  const m = method || 'GET';
  let payload;
  if(body !== undefined && m !== 'GET') payload = new TextEncoder().encode(JSON.stringify(body));
  const hdrs = [['accept','application/json, text/plain, */*']];
  if(payload) hdrs.push(['content-type','application/json']);
  const res = await Promise.race([
    t.request(new URL(url), m, payload, hdrs, undefined).catch(e => ({ err: e })),
    new Promise(r => setTimeout(() => r({ err: new Error('wisp timeout') }), ms || 9000))
  ]);
  if(res.err) return { error: (res.err && res.err.message) || 'wisp error' };
  let rbody = res.body;
  try{
    if(rbody && typeof rbody.getReader === 'function'){
      const rd = rbody.getReader(); const v = await rd.read(); try{ await rd.cancel(); }catch(e){}
      rbody = v && v.value;
    }
  }catch(e){}
  let text = '';
  try{ text = (rbody instanceof Uint8Array) ? new TextDecoder().decode(rbody) : String(rbody || ''); }catch(e){}
  let data = {};
  try{ data = JSON.parse(text); }catch(e){ data = { error: 'HTTP ' + (res.status || 0) + ' (non-JSON)' }; }
  if(res.status >= 400 && !data.error) data.error = 'HTTP ' + res.status;
  return data;
}

/* WebSocket wrapper that rides the wisp tunnel via the transport */
class FateWispWebSocket {
  constructor(url){
    this.url = url; this.readyState = 0;
    this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
    this._buf = []; this._fellBack = false;
    const t = window.FATE_TRANSPORT;
    if(!t){ setTimeout(() => this._goNative("no transport"), 0); return; }
    try{
      const [send, closeRaw] = t.connect(new URL(url), [], [],
        () => { if(this._fellBack) return; this.readyState = 1; this.onopen && this.onopen({}); },
        (data) => { if(this._fellBack) return; this.onmessage && this.onmessage({ data }); },
        (code, reason) => { if(this._fellBack) return; if(this.readyState === 0) return; this.readyState = 3; this.onclose && this.onclose({ code: code || 1006, reason: reason || '' }); },
        () => { if(this._fellBack || this.readyState === 1 || this.readyState === 0) return; this.readyState = 3; this.onerror && this.onerror({}); });
      this._sendRaw = send; this._closeRaw = closeRaw;
    }catch(e){
      setTimeout(() => this._goNative(String(e && e.message || e)), 0);
      return;
    }
    /* v6: tunnel not connecting in time -> transparent native fallback */
    setTimeout(() => { if(this.readyState === 0 && !this._fellBack) this._goNative('tunnel timeout'); }, 6000);
  }
  _goNative(why){
    if(this._fellBack || this.readyState === 1) return;
    this._fellBack = true;
    console.warn('[FATE v6] signal tunnel fallback -> direct (' + why + ')');
    let ws;
    try{ ws = new WebSocket(this.url); }catch(e){ this.readyState = 3; this.onerror && this.onerror({}); this.onclose && this.onclose({ code: 1006, reason: String(e) }); return; }
    ws.binaryType = 'arraybuffer';
    this._native = ws;
    ws.onopen = () => { this.readyState = 1; this.onopen && this.onopen({}); };
    ws.onmessage = (e) => { this.onmessage && this.onmessage({ data: e.data }); };
    ws.onclose = (e) => { this.readyState = 3; this.onclose && this.onclose({ code: e.code, reason: e.reason }); };
    ws.onerror = () => { if(this.readyState !== 1){ this.readyState = 3; this.onerror && this.onerror({}); } };
  }
  send(d){
    if(this.readyState !== 1) return;
    if(this._native){ try{ this._native.send(d); }catch(e){} }
    else { try{ this._sendRaw(d); }catch(e){} }
  }
  close(){
    if(this.readyState === 3) return;
    this.readyState = 3;
    if(this._native){ try{ this._native.close(); }catch(e){} }
    else { try{ this._closeRaw && this._closeRaw(1000, ''); }catch(e){} }
  }
}
function makeSignalWebSocket(wsUrl){
  if(window.FATE_TRANSPORT) return new FateWispWebSocket(wsUrl);
  return new WebSocket(wsUrl);
}

function fateStratusBases(){
  const list = [];
  const custom = _lsGet(FATE_STRATUS_CUSTOM_BASE_KEY);
  if(custom && custom.host) list.push('https://' + String(custom.host).replace(/^https?:\/\//, '').replace(/\/+$/, ''));
  if(window.FATE_STRATUS_BASE) list.push(String(window.FATE_STRATUS_BASE).replace(/\/+$/, ''));
  if(window.wlspServer && window.wlspServer.includes('://')){
    try{ list.push('https://' + new URL(window.wlspServer).host); }catch(e){}
  }
  const saved = savedStratusMirror();
  if(saved) list.push('https://' + saved);
  return [...new Set(list)];
}

function fateSaveBase(){
  const inp = document.getElementById('fateBaseInput');
  if(!inp) return;
  const host = String(inp.value || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if(!host){ _lsSet(FATE_STRATUS_CUSTOM_BASE_KEY, null); localStorage.removeItem(FATE_STRATUS_CUSTOM_BASE_KEY); return; }
  setStratusBase(host);
  _lsSet(FATE_STRATUS_CUSTOM_BASE_KEY, { host: host, t: Date.now() });
  fateRenderWispPanel(window.FATE_WISP_RESULTS);
  reloadCloudGames();
}

function fateRenderWispPanel(results){
  const box = document.getElementById('fateWispPanel');
  if(!box) return;
  const rows = (results || window.FATE_WISP_RESULTS || []).map(r =>
    `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;">
       <span style="color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.server.replace('wss://','')}</span>
       <span style="color:${r.rtt !== null ? '#4ade80' : '#f87171'};font-weight:700;white-space:nowrap;">${r.rtt !== null ? r.rtt + 'ms' : 'down'}</span>
     </div>`).join('');
  const lane = window.wlspServer ? window.wlspServer.replace('wss://', '') : '--';
  const bases = fateStratusBases().map(b => `<span style="color:#67e8f9;">${b.replace('https://','')}</span>`).join(' · ');
  const tr = window.FATE_TRANSPORT ? '<span style="color:#4ade80;font-weight:700;">ready</span>' : '<span style="color:#fbbf24;">loading…</span>';
  box.innerHTML =
    `<div style="font-weight:700;color:#e2e8f0;margin-bottom:4px;">Wisp lane (tunnel transport)</div>` +
    (rows || '<div style="color:#94a3b8;">probing…</div>') +
    `<div style="margin-top:6px;color:#94a3b8;">lane: <span style="color:#a78bfa;">${lane}</span> · transport: ${tr}</div>` +
    `<div style="margin-top:2px;color:#94a3b8;">bases: ${bases || '--'}</div>` +
    `<div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
       <input id="fateBaseInput" placeholder="backend host (from the working site)" style="flex:1;min-width:180px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;padding:5px 8px;font-size:.75rem;" />
       <button onclick="fateSaveBase()" style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:5px 10px;font-size:.75rem;font-weight:700;cursor:pointer;">set base</button>
     </div>`;
}
/* ===== END FATE PORTAL v6 WISP LANE ENGINE ===== */
"""

must_replace("/* ===== END FATE PORTAL v2 CLOUD STACK ===== */",
             ENGINE + "\n/* ===== END FATE PORTAL v2 CLOUD STACK ===== */",
             "v6 engine block")

# ---------------------------------------------------------------- patch sweep
# add wisp-lane attempts (through the tunnel) as the FIRST lane of the sweep
must_replace("""function sweepStratusCatalog(){
  const lanes = [null, 'codetabs', 'allorigins'];
  const attempts = [];""",
"""function sweepStratusCatalog(){
  const lanes = [null, 'codetabs', 'allorigins'];
  const attempts = [];
  /* v6: wisp-lane attempts first - these ride the tunnel and are the only
     lane that can reach a backend the local network blocks entirely. */
  fateStratusBases().forEach((h) => {
    attempts.push((async () => {
      try{
        const data = await stratusFetchWisp(String(h).replace(/^https?:\\/\\//, ''), 'games', 12000);
        const games = (data.games || []);
        return (!data.error && games.length) ? { host: String(h).replace(/^https?:\\/\\//, ''), games: games, via: 'wisp' } : null;
      }catch(e){ return null; }
    })());
  });""", "sweep wisp lane")

# ---------------------------------------------------------------- fetch POST support
must_replace("""/* one single-shot call against a specific mirror */
async function stratusFetch(host, path, ms){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 6500);
  try{
    const res = await fetch('https://' + host + '/stratus/' + path, { credentials: 'include', signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if(!res.ok && !data.error) data.error = 'HTTP ' + res.status;
    return data;
  }finally{ clearTimeout(t); }
}""",
"""/* one single-shot call against a specific mirror (v6: supports POST + body) */
async function stratusFetch(host, path, ms, method, body){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 6500);
  try{
    const opts = { credentials: 'include', signal: ctrl.signal };
    if(method && method !== 'GET'){
      opts.method = method;
      if(body !== undefined){ opts.body = JSON.stringify(body); opts.headers = { 'content-type': 'application/json' }; }
    }
    const res = await fetch('https://' + host + '/stratus/' + path, opts);
    const data = await res.json().catch(() => ({}));
    if(!res.ok && !data.error) data.error = 'HTTP ' + res.status;
    return data;
  }finally{ clearTimeout(t); }
}""", "stratusFetch POST support")

# ---------------------------------------------------------------- api fallback
# _stratusApiV2: wisp-lane first when the transport is up, direct ladder after
must_replace("""  for(let i = 0; i < tries; i++){
    try{
      const data = await stratusFetch(String(getBase()).replace(/^https?:\\/\\//, '').replace(/\\/+$/, ''), path, 9000);
      if(!data.error) return data;""",
"""  for(let i = 0; i < tries; i++){
    try{
      const hostOnly = String(getBase()).replace(/^https?:\\/\\//, '').replace(/\\/+$/, '');
      let data = null;
      if(window.FATE_TRANSPORT){
        const wd = await stratusFetchWisp(hostOnly, path, 9000, method, body);
        if(!wd.error) return wd;
        if(!FATE_TRANSIENT.test(wd.error)) { if(i === tries - 1) return wd; }
      }
      data = await stratusFetch(hostOnly, path, 9000, method, body);
      if(!data.error) return data;""", "stratusApi wisp-first")

# ---------------------------------------------------------------- signal WS
must_replace("""    const sid = signalingWs.split("/").pop();
    const apiBase = `${getBase()}/stratus`;
    const u = new URL(apiBase);
    const wsUrl = (u.protocol === "https:" ? "wss://" : "ws://") + u.host + u.pathname.replace(/\\/$/, "") + "/signal/" + sid;
    const ws = new WebSocket(wsUrl);""",
"""    const sid = signalingWs.split("/").pop();
    /* v6: the backend now returns an absolute signaling_ws (host/signal/<id>);
       only build from getBase() for legacy id-only values */
    const wsUrl = /^wss?:\\/\\//i.test(signalingWs) ? signalingWs : (() => {
      const apiBase = `${getBase()}/stratus`;
      const u = new URL(apiBase);
      return (u.protocol === "https:" ? "wss://" : "ws://") + u.host + u.pathname.replace(/\\/$/, "") + "/signal/" + sid;
    })();
    /* v6: signaling rides the wisp tunnel when the transport is up */
    const ws = makeSignalWebSocket(wsUrl);""", "signaling via transport")

# tolerant JSON decode (libcurl WS may deliver ArrayBuffer frames)
must_replace("""      let msg;
      try{ msg = JSON.parse(evt.data); }catch(e){ return; }""",
"""      let msg;
      try{
        const rd = evt.data;
        msg = JSON.parse(typeof rd === "string" ? rd : new TextDecoder().decode(rd));
      }catch(e){ return; }""", "signal JSON tolerant")

# ---------------------------------------------------------------- quit via tunnel
must_replace("""function _quitCloudSession(uuid){
  uuid && fetch(`${getBase()}/stratus/session/${uuid}/quit`, { credentials: "include", method: "POST", keepalive: true }).catch(() => {});
}""",
"""function _quitCloudSession(uuid){
  if(!uuid) return;
  try{
    const url = `${getBase()}/stratus/session/${uuid}/quit`;
    if(window.FATE_TRANSPORT) window.FATE_TRANSPORT.request(new URL(url), "POST", undefined, [["content-type","application/json"]], undefined).catch(() => {});
    fetch(url, { credentials: "include", method: "POST", keepalive: true }).catch(() => {});
  }catch(e){}
}""", "quit via tunnel")

# ---------------------------------------------------------------- UI: panel host
must_replace("""        <b style="font-size:.85rem;color:#e2e8f0;">Mirror self-test <span id="selfTestPhase" style="color:#94a3b8;font-weight:500;"></span></b>""",
"""        <b style="font-size:.85rem;color:#e2e8f0;">Mirror self-test <span id="selfTestPhase" style="color:#94a3b8;font-weight:500;"></span></b>
        <div id="fateWispPanel" style="margin-top:8px;padding:8px 10px;background:#0b1220;border:1px solid #1e293b;border-radius:10px;font-size:.72rem;"></div>""", "wisp panel host")

# ---------------------------------------------------------------- boot
must_replace("""/* ===== END FATE PORTAL v2 CLOUD STACK ===== */""",
"""/* ===== END FATE PORTAL v2 CLOUD STACK ===== */

/* v6 boot: sweep the wisp lanes, load the tunnel transport, re-hunt cloud */
async function fateBootCloud(){
  try{
    const res = await fateWispSweep();
    fateRenderWispPanel(res);
    const anyAlive = window.FATE_WISP_RESULTS.some(r => r.rtt !== null);
    if(!anyAlive){
      console.warn('[FATE v6] no wisp lane alive - cloud games unreachable');
      fateRenderWispPanel(res);
      return;
    }
    const t = await fateLoadTransport();
    fateRenderWispPanel(window.FATE_WISP_RESULTS);
    if(t){
      try{ reloadCloudGames(); }catch(e){ console.warn('[FATE v6] re-hunt failed:', e && e.message); }
    }
  }catch(e){ console.warn('[FATE v6] boot error:', e && e.message); }
}
setTimeout(fateBootCloud, 1200);""", "v6 boot hook")

# ---------------------------------------------------------------- stamps
must_replace("cloud build v5 — smart player + touch keys + arcade network + 27-lane sweep",
             "cloud build v6 — wisp lane tunnel + smart player + arcade network", "footer chip")
must_replace("[FATE PORTAL v5] arcade network + cloud stack build 2026-10-27 - 27-lane sweep + mirror self-test + persistent retry",
             "[FATE PORTAL v6] wisp lane tunnel build 2026-10-27 - wisp sweep + curl transport + cloud re-hunt", "console marker v5")
must_replace("const FATE_SEED_CATALOG = null;",
             "const FATE_SEED_CATALOG = null;\n/* v6: wisp lane engine appends its block above; see FATE PORTAL v6 WISP LANE ENGINE */", "v6 marker")

open(DST, "w", encoding="utf-8").write(html)
print(f"stage-1 written: {DST} ({len(html)} bytes, was {orig_len})")
