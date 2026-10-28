
/* ===== FATE MOVIES WISP LANE HOST (shared fate_wisp_lane_v6 cache with the portal) ===== */
function _lsGet(k){ try{ return JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ return null; } }
function _lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

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
      for (let _ti = 0; _ti < 150; _ti++){
        try { await t.init(); break; }
        catch (_e){
          if (!String(_e).includes('wasm not loaded') || _ti === 149) throw _e;
          await new Promise(_r => setTimeout(_r, 20));
        }
      }
      window.FATE_TRANSPORT = t;
      window.FATE_ASSETS_BASE_USED = base;
      console.log('[FATE MOVIES] wisp transport READY - lane', window.wlspServer, '- assets', base);
      return t;
    }catch(e){ console.warn('[FATE MOVIES] transport base failed:', base, (e && e.message) || e); }
  }
  console.warn('[FATE MOVIES] no asset base could serve curl/index.mjs');
  return null;
}
/* ===== END WISP LANE HOST ===== */
