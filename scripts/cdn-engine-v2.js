/* ===== FATE ARCADE CDN ENGINE v2 — straight browser→CDN, zero proxy, zero tunnel ===== */
console.log('%c[FATE ARCADE] direct CDN engine v2 loaded (no proxy, no jet)', 'color:#4ade80;font-weight:bold;');

/* jsDelivr edges to rotate through (same trick the big sites use) */
const FATE_CDN_MIRRORS = ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'gcore.jsdelivr.net', 'testingcf.jsdelivr.net', 'quantil.jsdelivr.net'];

/* hosts that serve game HTML as text/plain (would show raw code in an iframe)
   -> always fetch the code and render it locally as a blob */
const FATE_FETCH_HOSTS = [
  /(^|\.)cdn\.jsdelivr\.net$/i, /(^|\.)fastly\.jsdelivr\.net$/i, /(^|\.)gcore\.jsdelivr\.net$/i,
  /(^|\.)testingcf\.jsdelivr\.net$/i, /(^|\.)quantil\.jsdelivr\.net$/i, /(^|\.)originfastly\.jsdelivr\.net$/i,
  /(^|\.)raw\.githubusercontent\.com$/i, /(^|\.)rawcdn\.githack\.com$/i, /(^|\.)raw\.githack\.com$/i,
  /(^|\.)cdn\.statically\.io$/i, /(^|\.)uploads\.ungrounded\.net$/i
];
/* hosts probed to refuse embedding AND cross-origin reads — code fetch is the only chance */
const FATE_NO_EMBED = [
  /(^|\.)8ballpool\.com$/i, /(^|\.)humanornot\.so$/i, /(^|\.)now\.gg$/i, /(^|\.)totaljerkface\.com$/i,
  /(^|\.)coolmathgames\.com$/i, /(^|\.)mathplayground\.com$/i, /(^|\.)silvergames\.com$/i, /(^|\.)itch\.io$/i
];

const fateHost = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };
const fateNeedsFetch = u => FATE_FETCH_HOSTS.some(rx => rx.test(fateHost(u))) || FATE_NO_EMBED.some(rx => rx.test(fateHost(u)));

/* expand one game URL into every CDN route we can try */
function fateMirrors(u){
  const list = [];
  try {
    const url = new URL(u);
    let m = url.href.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/);
    if (m){
      const [, user, repo, ref, path] = m;
      for (const host of FATE_CDN_MIRRORS) list.push('https://' + host + '/gh/' + user + '/' + repo + '@' + ref + '/' + path);
      list.push('https://raw.githubusercontent.com/' + user + '/' + repo + '/' + ref + '/' + path);
    } else if (url.hostname === 'raw.githubusercontent.com'){
      const seg = url.pathname.split('/').filter(Boolean);
      if (seg.length >= 4){
        const [user, repo, ref] = seg, path = seg.slice(3).join('/');
        for (const host of FATE_CDN_MIRRORS) list.push('https://' + host + '/gh/' + user + '/' + repo + '@' + ref + '/' + path);
      }
      list.push(url.href);
    } else list.push(url.href);
  } catch (e) { list.push(u); }
  return [...new Set(list)];
}

/* fetch one route, validate it looks like a game page */
function fateFetchOne(url, timeoutMs){
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), timeoutMs || 14000);
    fetch(url, { signal: ac.signal, redirect: 'follow' }).then(async r => {
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text();
      if (!/<html|<!doctype|<script|<canvas|<iframe/i.test(t)) throw new Error('not a game page');
      resolve({ text: t, url: r.url || url });
    }).catch(e => { clearTimeout(to); reject(e); });
  });
}
/* resolve when the first promise fulfills (Promise.any with a manual fallback) */
function fateRace(ps){
  return new Promise((resolve, reject) => {
    let pending = ps.length, done = false;
    if (!pending) return reject(new Error('no routes'));
    ps.forEach(p => p.then(v => { if (!done){ done = true; resolve(v); } })
      .catch(() => { if (--pending === 0 && !done){ done = true; reject(new Error('all routes failed')); } }));
  });
}

/* in-memory code cache: reopening a game is instant */
const FATE_GAME_CACHE = new Map();
async function fateRetrieve(u){
  if (FATE_GAME_CACHE.has(u)) return FATE_GAME_CACHE.get(u);
  const mirrors = fateMirrors(u);
  let got = null;
  try { got = await fateRace(mirrors.slice(0, 3).map(mi => fateFetchOne(mi, 14000))); }
  catch (e1) {
    for (const mi of mirrors.slice(3)){
      try { got = await fateFetchOne(mi, 14000); break; } catch (e2) {}
    }
  }
  if (!got) throw new Error('every CDN route failed (' + mirrors.length + ' tried)');
  FATE_GAME_CACHE.set(u, got);
  return got;
}

function fateWithBase(text, url){
  const doc = new DOMParser().parseFromString(text, 'text/html');
  if (!doc.querySelector('base')){
    const b = doc.createElement('base'); b.href = url;
    (doc.head || doc.documentElement).prepend(b);
  }
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}
async function fatePlayableHTML(g, onStage){
  let r = await fateRetrieve(g.url);
  if (onStage) onStage('code loaded — ' + Math.round(r.text.length / 1024) + ' KB, preparing…');
  if (g.source === 'Lumin'){
    /* peel single-iframe jsdelivr wrappers (up to 3 deep) */
    const visited = new Set([r.url]);
    for (let depth = 0; depth < 3; depth++){
      const doc = new DOMParser().parseFromString(r.text, 'text/html');
      const frames = doc.querySelectorAll('iframe[src]');
      if (frames.length !== 1 || doc.querySelector('canvas')) break;
      const raw = frames[0].getAttribute('src');
      const base = doc.querySelector('base[href]')?.getAttribute('href');
      const url = new URL(raw, base ? new URL(base, r.url).href : r.url).href;
      if (!/^https?:/.test(url) || !url.includes('jsdelivr.net/') || visited.has(url)) break;
      visited.add(url);
      if (onStage) onStage('unwrapping layer ' + (depth + 2) + '…');
      r = await fateRetrieve(url);
    }
  }
  return fateWithBase(r.text, r.url);
}
