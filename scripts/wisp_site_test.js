#!/usr/bin/env node
var dQ, A0;
/* ============================================================================================
 * FATE movie-site wisp tester — part 1: the REAL wisp client extracted from site/gn-math.html
 * (libcurl-wisp classes g0/Di, byte-identical to what the FATE engine sends at runtime)
 * ============================================================================================ */
function BC(m) { console.error('[bc]', m); }
dQ={CONNECT:1,DATA:2,CONTINUE:3,CLOSE:4},A0=[void 0,"CONNECT","DATA","CONTINUE","CLOSE"];function AC(I){if(I.length==4)return new Uint32Array(I.buffer)[0];if(I.length==2)return new Uint16Array(I.buffer)[0];if(I.length==1)return I[0];throw"invalid array length"}function NB(I,E){let i=new ArrayBuffer(E),t=new DataView(i);if(E==1)t.setUint8(0,I,!0);else if(E==2)t.setUint16(0,I,!0);else if(E==4)t.setUint32(0,I,!0);else throw"invalid array length";return new Uint8Array(i)}function ri(){let I=0;for(let t of arguments)I+=t.length;let E=new Uint8Array(I),i=0;for(let t of arguments)E.set(t,i),i+=t.length;return E}function gC(I,E,i){let t=NB(E,4),s=NB(I,1);return ri(s,t,i)}class g0 extends EventTarget{constructor(E,i,t,s,n,w,R){super(),this.hostname=E,this.port=i,this.ws=t,this.buffer_size=s,this.stream_id=n,this.connection=w,this.stream_type=R,this.send_buffer=[],this.open=!0}send(E){if(this.buffer_size>0||!this.open||this.stream_type===2){let i=gC(2,this.stream_id,E);this.ws.send(i),this.buffer_size--}else this.send_buffer.push(E)}continue_received(E){for(this.buffer_size=E;this.buffer_size>0&&this.send_buffer.length>0;)this.send(this.send_buffer.shift())}close(E=1){if(!this.open)return;let i=NB(E,1),t=gC(4,this.stream_id,i);this.ws.send(t),this.open=!1,delete this.connection.active_streams[this.stream_id]}}class Di extends EventTarget{constructor(E){if(super(),this.wisp_url=E,this.max_buffer_size=null,this.active_streams={},this.connected=!1,this.connecting=!1,this.next_stream_id=1,!this.wisp_url.endsWith("/"))throw"wisp endpoints must end with a trailing forward slash";this.connect_ws()}connect_ws(){this.ws=new WebSocket(this.wisp_url),this.ws.binaryType="arraybuffer",this.connecting=!0,this.ws.addEventListener("error",E=>{this.on_ws_close();let i=new Event("error");this.dispatchEvent(i)}),this.ws.addEventListener("close",()=>{this.on_ws_close();let E=new CloseEvent("close");this.dispatchEvent(E)}),this.ws.addEventListener("message",E=>{if(this.on_ws_msg(E),this.connecting){this.connected=!0,this.connecting=!1;let i=new Event("open");this.dispatchEvent(i)}})}close_stream(E,i){let t=new CloseEvent("close",{code:i});E.open=!1,E.dispatchEvent(t),delete this.active_streams[E.stream_id]}on_ws_close(){this.connected=!1,this.connecting=!1;for(let E of Object.keys(this.active_streams))this.close_stream(this.active_streams[E],3)}create_stream(E,i,t="tcp"){let s=t==="udp"?2:1,n=this.next_stream_id;this.next_stream_id++;let w=new g0(E,i,this.ws,this.max_buffer_size,n,this,s);w.open=this.connected;let R=NB(s,1),N=NB(i,2),J=new TextEncoder().encode(E),H=ri(R,N,J),X=gC(1,n,H);return this.active_streams[n]=w,this.ws.send(X),w}on_ws_msg(E){let i=new Uint8Array(E.data);if(i.length<5){BC("wisp client warning: received a packet which is too short");return}let t=i[0],s=AC(i.slice(1,5)),n=i.slice(5),w=this.active_streams[s];if(typeof w>"u"&&s!==0){BC(`wisp client warning: received a ${A0[t]} packet for a stream which doesn't exist`);return}if(t===dQ.DATA){let R=new MessageEvent("message",{data:n});w.dispatchEvent(R)}else t===dQ.CONTINUE&&s==0?this.max_buffer_size=AC(n):t===dQ.CONTINUE?w.continue_received(AC(n)):t===dQ.CLOSE?this.close_stream(w,n[0]):BC(`wisp client warning: receive an invalid packet of type ${t}`)}}

/* ============================================================================================
 * part 2: harness — endpoint scan + HTTPS site tests through the engine's own wisp client
 * ============================================================================================ */
const nodeStream = require('node:stream');
const nodeTls = require('node:tls');
const nodeFs = require('node:fs');

/* ---------- candidate movie sites (FMHY wiki 2026-11-05 + user's references) ---------- */
const SITES = [
  ['Aetheris', 'aetheris.win'],
  ['Moxy (The Moxy Files)', 'moxy.neocities.org'],
  ['Aether', 'aether.st'],
  ['Movy', 'movy.sx'],
  ['Cinejoy', 'cinejoy.pk'],
  ['PopcornMovies', 'popcornmovies.st'],
  ['7Movies', '7movies.ac'],
  ['Atlantic', 'atlantic.bz'],
  ['ShuttleTV', 'shuttletv.su'],
  ['FlyStream', 'flystream.net'],
  ['Vivarium', 'vivarium.su'],
  ['Rive', 'rivestream.app'],
  ['Flixer', 'flixer.gd'],
  ['MeowTV', 'meowtv.ru'],
  ['CineLite', 'cinelite.xyz'],
  ['Ghostflix', 'ghostflix.st'],
  ['ArrowTV', 'arrowtv.net'],
  ['Chillflix', 'chillflix.lol'],
  ['Dulo', 'dulo.mov'],
  ['Reelix', 'reelix.ac'],
  ['MoanaTV', 'lfmx.app'],
  ['SweetFox', 'sweetfox.app'],
  ['Cinecat', 'cinecat.eu'],
  ['Basement', 'basementx.lol'],
  ['Cno', 'cno.to'],
  ['NEPU', 'nepu.io'],
  ['PressPlay', 'pressplayx.to'],
  ['RidoMovies', 'ridomovies.is'],
  ['LookMovie', 'lookmovie2.to'],
  ['AZMovies', 'azmovies.to'],
  ['1Shows', '1shows.org'],
  ['HydraHD', 'hydrahd.gd'],
  ['AniCine', 'anicine.sbs'],
  ['ZetMoon', 'zetmoon.live'],
  ['TonkaCine', 'tonkacine.watch'],
  ['Moovie', 'moovie.fun'],
  ['PrimeShows', 'primeshows.org'],
  ['CinebyTV', 'cinebytv.com'],
  ['WCOStream', 'www.wcostream.tv'],
  ['MegaCartoons', 'www.megacartoons.net'],
  ['SuperCartoons', 'www.supercartoons.net'],
  ['Levidia', 'www.levidia.ch'],
  ['Goojara', 'ww1.goojara.to'],
  ['Noxx', 'noxx.gg'],
  ['HiAnime', 'hianimes.ru'],
];

/* ---------- wisp endpoint pool (site/wisp-scanner.html BAKED_ENDPOINTS) ---------- */
const ENDPOINTS = [
  'wss://0.catclass.net/wisp/','wss://3658729.ritebooks.com/wisp/','wss://55gms.com/wisp/',
  'wss://admin.proxy.hydrovolter.com/scramjet/wisp/','wss://anura.pro/','wss://anura.pro/api/wisp/',
  'wss://anura.pro/w/','wss://anura.pro/wisp/','wss://api.ixl.college/ws/',
  'wss://api.personalloanonline.net/ws/','wss://api.sngdu.com/ws/','wss://app-dry-waterfall-5636.fly.dev/wisp/',
  'wss://arctic.lat/','wss://arctic.lat/_q/','wss://arctic.lat/wisp/',
  'wss://arsenic.smartfoloo.space/api/wisp/','wss://arsenic.smartfoloo.space/wisp/','wss://athollcottage.com/connection/',
  'wss://bare-server.fly.dev/api/wisp/','wss://bare-server.fly.dev/wisp/','wss://browserjs-production.up.railway.app/wisp/',
  'wss://businessschool.cc/wisp/','wss://cdn.pcesc.org/','wss://cdn.vipersfutbol.com/',
  'wss://celestial.press/wisp/','wss://charityschools.a2zrealty.biz/wisp/','wss://civil.quartinal.me/api/wisp/',
  'wss://construction.services.codd70.ru/socket/','wss://crypto-college.cc/wisp/','wss://daydreamx.pro/wisp/',
  'wss://definitelyscience.com/api/wisp/','wss://definitelyscience.com/wisp/','wss://ela.next-education-learning.sbs/wisp/',
  'wss://fern.best/wisp/','wss://fulcrumtheatreinc.com/wisp/',
  'wss://glseries.net/wisp/','wss://gointospace.app/wisp/','wss://holyunb.locker/api/wisp/',
  'wss://homeworkhelp.cc/wisp/','wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/','wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/wisp/',
  'wss://i-ready.math.bostoncareercounselor.com/wisp/','wss://info.hotelsunrisegrand.com/wisp/',
  'wss://info.shop1stoponline.com/wisp/','wss://info.videnom.com/wisp/','wss://invisiproxy.com/wisp/',
  'wss://lichology.com/api/wisp/','wss://lichology.com/wisp/',
  'wss://linuxontab-net.fly.dev/wisp/','wss://luna.loan/wisp/',
  'wss://lunaron.top/w/','wss://lunarrr.eminescusm.ro/wisp/','wss://mages.io/api/wisp/',
  'wss://mages.io/wisp/','wss://math.luminalos.com/cdn-cgi/p/','wss://nocturne.lol/w/',
  'wss://nocturne.lol/wisp/','wss://onyxv1.ai.studio/wisp/','wss://petezahgames.com/wisp/',
  'wss://pgis-wisp-2.onrender.com/','wss://pgis-wisp-3.onrender.com/','wss://pgis-wisp-4.onrender.com/',
  'wss://pgis-wisp.bonto.run/','wss://pgis-wisp.getvoroa.com/','wss://pgis-wisp.joytree.site/',
  'wss://pgis-wisp.onrender.com/','wss://phosphur.etcherfx.dev/wisp/','wss://places.vjason.com/wisp/',
  'wss://puter.cafe/','wss://relay.damus.io/',
  'wss://relay.lax1dude.net/','wss://relay.widgetry.org/','wss://sciencenews.cc/wisp/',
  'wss://sciencepark.cc/wisp/','wss://shadow-3.swanndvr.net/api/wisp/','wss://shadow-3.swanndvr.net/wisp/',
  'wss://shadow.curesoutpost.com/api/wisp/','wss://shadow.curesoutpost.com/wisp/','wss://space.asirargentina.com.ar/wisp/',
  'wss://studyhub.hadtea.com/wisp/','wss://studyhub.kkmsilvia.com/wisp/',
  'wss://terbiumon.top/api/wisp/','wss://terbiumon.top/wisp/','wss://tokyo.new-updates.info/wisp/',
  'wss://triplet.bumon.ar/wisp/','wss://tungtung.best/wisp/',
  'wss://tungtung.kkmsilvia.com/wisp/','wss://v2.quest/cdn-cgi/p/','wss://wisp-js-0nma.onrender.com/',
  'wss://wisp-server-workers.dotlyhiyou.workers.dev/','wss://wisp.classroom.lat/wisp/','wss://wisp.englishrevision.site/wisp/',
  'wss://wisp.frostcatcher.com/wisp/','wss://wisp.mercurywork.shop/','wss://wisp.mercurywork.shop/api/wisp/',
  'wss://wisp.mercurywork.shop/w/','wss://wisp.mercurywork.shop/wisp/','wss://wisp.rhw.one/',
  'wss://wisp.rhw.one/wisp/','wss://wisp.terbiumon.top/wisp/','wss://wisp.waved.site/',
  'wss://wisp.waved.site/api/wisp/','wss://wisp.waved.site/w/','wss://wisp.waved.site/wisp/',
  'wss://wisp.webmc.fun/','wss://wisp.webmc.fun/api/wisp/','wss://wisp.webmc.fun/w/',
  'wss://wisp.webmc.fun/wisp/','wss://wisp.webmc.xyz/','wss://wisp.zaka.qzz.io/wisp/',
  'wss://wispy.thewellnessconference.org/wisp/','wss://yashsurjuse-wisp.hf.space/','wss://yashsurjuse-wisp.hf.space/wisp/',
];

/* ---------- per-endpoint connection manager (persistent Di, sequential streams) ---------- */
class Lane {
  constructor(ep) { this.ep = ep; this.conn = null; this.busy = false; this.dead = false; this.lat = null; this.uses = 0; }
  async ensure() {
    if (this.conn && this.conn.connected) return this.conn;
    this.conn = await new Promise((resolve, reject) => {
      let c;
      try { c = new Di(this.ep); } catch (e) { return reject(new Error('ctor:' + e)); }
      const t = setTimeout(() => reject(new Error('ws-timeout')), 9000);
      c.addEventListener('open', () => { clearTimeout(t); resolve(c); });
      c.addEventListener('error', () => { clearTimeout(t); reject(new Error('ws-error')); });
    });
    this.conn.addEventListener('close', () => { this.conn = null; });
    return this.conn;
  }
  kill() { try { this.conn && this.conn.ws && this.conn.ws.close(); } catch (e) {} this.conn = null; }
}

/* g0 stream -> Duplex so node:tls can run through the tunnel */
function g0Duplex(s) {
  const d = new nodeStream.Duplex({
    write(chunk, enc, cb) { try { s.send(new Uint8Array(chunk)); cb(); } catch (e) { cb(e); } },
    read() {},
  });
  s.addEventListener('message', (e) => { d.push(Buffer.from(e.data)); });
  s.addEventListener('close', () => { d.push(null); });
  d.on('error', () => {});
  return d;
}

/* one HTTPS GET through one lane; resolves {status, headers, title, bytes, ms} or {error} */
function httpsViaLane(lane, host, path, overallMs) {
  return (async () => {
    const t0 = Date.now();
    const conn = await lane.ensure();
    const s = conn.create_stream(host, 443, 'tcp');
    // wait for per-stream CONTINUE (buffer_size becomes a number)
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('stream-timeout')), 10000);
      const poll = setInterval(() => {
        if (typeof s.buffer_size === 'number') { clearInterval(poll); clearTimeout(t); resolve(); }
        if (!conn.connected) { clearInterval(poll); clearTimeout(t); reject(new Error('lane-closed')); }
      }, 25);
      s.addEventListener('close', (e) => { clearInterval(poll); clearTimeout(t); reject(new Error('wisp-close-' + (e.code || '?'))); });
    });
    const tConn = Date.now() - t0;
    const duplex = g0Duplex(s);
    const tlsSock = await new Promise((resolve, reject) => {
      const sock = nodeTls.connect({ socket: duplex, servername: host, rejectUnauthorized: false, ALPNProtocols: ['http/1.1'] }, () => resolve(sock));
      sock.once('error', (e) => reject(new Error('tls-' + (e.code || e.message))));
      setTimeout(() => { try { sock.destroy(); } catch (e) {} reject(new Error('tls-timeout')); }, 12000);
    });
    const tTls = Date.now() - t0;
    const res = await new Promise((resolve, reject) => {
      let acc = Buffer.alloc(0), headerDone = false, status = null, headers = {}, bodyStart = 0;
      const to = setTimeout(() => { finish(); }, overallMs || 15000);
      const finish = () => {
        clearTimeout(to);
        const text = acc.toString('latin1');
        const body = headerDone ? text.slice(bodyStart) : '';
        const tm = /<title[^>]*>([^<]{0,150})/i.exec(body);
        const r = { status, headers, title: tm ? tm[1].replace(/\s+/g, ' ').trim() : null, bytes: acc.length, tConn, tTls, ms: Date.now() - t0 };
        try { tlsSock.destroy(); } catch (e) {}
        try { s.close(0); } catch (e) {}
        resolve(r);
      };
      tlsSock.on('data', (c) => {
        acc = Buffer.concat([acc, c]);
        if (!headerDone) {
          const idx = acc.indexOf('\r\n\r\n');
          if (idx >= 0) {
            headerDone = true; bodyStart = idx + 4;
            const head = acc.slice(0, idx).toString('latin1').split('\r\n');
            const m = /^HTTP\/[\d.]+ (\d{3})/.exec(head[0]); status = m ? +m[1] : null;
            for (let i = 1; i < head.length; i++) { const p = head[i].indexOf(':'); if (p > 0) headers[head[i].slice(0, p).trim().toLowerCase()] = head[i].slice(p + 1).trim(); }
          }
        }
        if (acc.length > 150000) finish();
      });
      tlsSock.on('error', () => finish());
      tlsSock.on('close', () => finish());
      tlsSock.on('end', () => finish());
      tlsSock.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8\r\nAccept-Language: en-US,en;q=0.9\r\nUpgrade-Insecure-Requests: 1\r\nSec-Fetch-Mode: navigate\r\nConnection: close\r\n\r\n`);
    });
    return res;
  })().catch(e => ({ error: String(e.message || e).slice(0, 60) }));
}

/* ---------- helpers ---------- */
const OUT = '/home/z/my-project/scripts/wisp_site_results.json';
function saveState(state) { nodeFs.writeFileSync(OUT, JSON.stringify(state, null, 1)); }
async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; try { results[idx] = await fn(items[idx], idx); } catch (e) { results[idx] = { error: String(e) }; } }
  }));
  return results;
}

/* ---------- main ---------- */
async function main() {
  const phase = process.argv[2] || 'all';
  let state = {};
  if (nodeFs.existsSync(OUT)) { try { state = JSON.parse(nodeFs.readFileSync(OUT, 'utf8')); } catch (e) {} }

  /* phase A: endpoint health — one plain-HTTP stream (example.com:80) per endpoint */
  if ((phase === 'all' || phase === 'endpoints') && !state.endpoints) {
    console.log(`[A] scanning ${ENDPOINTS.length} endpoints with the engine client...`);
    const lanes = ENDPOINTS.map(ep => new Lane(ep));
    const res = await pool(lanes, 14, async (lane) => {
      try {
        const r = await httpsViaLane(lane, 'example.com', '/', 14000);
        lane.kill();
        if (r.status) return { ep: lane.ep, status: r.status, ms: r.ms };
        return { ep: lane.ep, error: r.error };
      } catch (e) { lane.kill(); return { ep: lane.ep, error: String(e.message || e) }; }
    });
    const alive = res.filter(r => r.status).sort((a, b) => a.ms - b.ms);
    state.endpoints = { scanned: ENDPOINTS.length, alive, dead: res.length - alive.length };
    saveState(state);
    console.log(`[A] alive with real HTTP: ${alive.length}/${ENDPOINTS.length}`);
    alive.slice(0, 12).forEach(a => console.log(`    ${String(a.ms).padStart(5)}ms  ${a.ep}`));
  }
  if (phase === 'endpoints') return;

  /* phase B: sites through the fastest alive lanes */
  const lanes = (state.endpoints.alive || []).slice(0, 8).map(a => { const l = new Lane(a.ep); l.lat = a.ms; return l; });
  if (!lanes.length) { console.log('no alive lanes'); return; }
  console.log(`[B] testing ${SITES.length} sites over ${lanes.length} lanes...`);
  state.sites = state.sites || {};
  let done = Object.values(state.sites).filter(r => r.status).length;
  await pool(SITES, Math.min(10, lanes.length * 2), async ([name, host]) => {
    if (state.sites[host] && state.sites[host].status) return;
    let best = null;
    for (const lane of lanes) {
      const r = await httpsViaLane(lane, host, '/', 16000);
      if (r.status) { best = { name, ep: lane.ep, status: r.status, title: r.title, bytes: r.bytes, ms: r.ms, loc: r.headers['location'] || null, server: r.headers['server'] || null }; break; }
      best = { name, error: r.error };
      if (lane.conn === null) { try { await lane.ensure(); } catch (e) { lane.dead = true; break; } }
      if (lane.dead) break;
    }
    state.sites[host] = best;
    if (best.status) done++;
    const tag = best.status ? best.status : 'FAIL ' + best.error;
    console.log(`    ${String(done).padStart(2)}/${SITES.length}  ${name.padEnd(22)} ${String(tag).padEnd(28)} ${best.status ? (best.title || best.loc || '') .slice(0, 60) : ''}`);
    saveState(state);
  });
  saveState(state);
  const ok = Object.values(state.sites).filter(r => r.status && r.status < 400);
  const soft = Object.values(state.sites).filter(r => r.status && r.status >= 400);
  const fail = Object.values(state.sites).filter(r => !r.status);
  console.log(`\n[B] reachable(<400): ${ok.length}   soft-blocked(4xx/5xx): ${soft.length}   failed: ${fail.length}`);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
