#!/usr/bin/env python3
"""Patch upload/test.html with Stratus mirror rotation → download/test-fixed.html.

The portal's live loader keeps a serverList and health-pings each mirror.
test.html hardcoded cdn.vipersfutbol.com, which is now dead → cloud games
never load. This patch ports the rotation into the static page:
  - probe all mirrors in parallel on page load
  - pick the first that answers /stratus/status with JSON
  - cache the pick for 10 min (localStorage), fall back to first mirror
  - getBase() prefers the saved/picked mirror
"""

SRC = "/home/z/my-project/upload/test.html"
DST = "/home/z/my-project/download/test-fixed.html"

MIRROR_BLOCK = """/* ===== STRATUS MIRROR ROTATION (fix: mirrors die often) ===== */
const FATE_STRATUS_MIRRORS = [
  'cdn.northstreetumc.org',
  'cdn.vipersfutbol.com',
  'cdn.pcesc.org',
  'cdn.kcchallengevbc.com',
  'cdn.slcbmooc.org',
  'cdn.topstargym.net',
  'cdn.goaplytexas.org',
  'cdn.clearfieldswimming.com',
  'cdn.richardacademy.cfd'
];
const FATE_MIRROR_KEY = 'fate_stratus_mirror';
function savedStratusMirror(){
  try{
    const s = JSON.parse(localStorage.getItem(FATE_MIRROR_KEY) || 'null');
    return s && s.host ? s.host : null;
  }catch(e){ return null; }
}
async function pickStratusMirror(force){
  try{
    const s = JSON.parse(localStorage.getItem(FATE_MIRROR_KEY) || 'null');
    if(s && s.host && !force && Date.now() - s.t < 600000) return s.host;
  }catch(e){}
  const probe = async (h) => {
    try{
      const c = new AbortController(), t = setTimeout(() => c.abort(), 5000);
      const r = await fetch('https://' + h + '/stratus/status', { credentials: 'include', signal: c.signal });
      clearTimeout(t);
      if(!r.ok) return null;
      const j = await r.json().catch(() => null);
      return (j && j.error === undefined) ? h : null;
    }catch(e){ return null; }
  };
  const results = await Promise.all(FATE_STRATUS_MIRRORS.map(probe));
  const pick = results.find(Boolean) || FATE_STRATUS_MIRRORS[0];
  try{ localStorage.setItem(FATE_MIRROR_KEY, JSON.stringify({ host: pick, t: Date.now() })); }catch(e){}
  console.log('[FATE CDN] stratus mirror →', pick, results.filter(Boolean).length + '/' + results.length + ' alive');
  return pick;
}
async function ensureStratusBase(){
  if(window.FATE_STRATUS_BASE) return;
  const host = await pickStratusMirror();
  window.FATE_STRATUS_BASE = 'https://' + host;
}
/* ===== END STRATUS MIRROR ROTATION ===== */

function getBase(){"""

with open(SRC, encoding="utf-8") as f:
    t = f.read()

checks = []

# 1. inject mirror block before getBase()
anchor = "function getBase(){"
assert t.count(anchor) == 1, f"getBase anchor x{t.count(anchor)}"
t = t.replace(anchor, MIRROR_BLOCK, 1)
checks.append("mirror block injected")

# 2. getBody defaults → prefer saved/picked mirror
o1 = "(window.serverList && window.serverList[0] || 'cdn.vipersfutbol.com')"
n1 = "(window.serverList && window.serverList[0] || savedStratusMirror() || 'cdn.northstreetumc.org')"
assert t.count(o1) == 1, f"devMode default x{t.count(o1)}"
t = t.replace(o1, n1, 1)
checks.append("devMode default patched")

o2 = ": (window.wlspServer && window.wlspServer.includes('://') ? window.wlspServer.split('://')[1].split('/')[0] : 'cdn.vipersfutbol.com');"
n2 = ": (savedStratusMirror() || (window.wlspServer && window.wlspServer.includes('://') ? window.wlspServer.split('://')[1].split('/')[0] : 'cdn.northstreetumc.org'));"
assert t.count(o2) == 1, f"wlsp default x{t.count(o2)}"
t = t.replace(o2, n2, 1)
checks.append("wlsp default patched")

# 3. bootstrap the pick inside init() before the catalog fetch
o3 = "  // Stratus cloud-streaming games (real cloud gaming)\n  const cloudGames = await fetchStratusGames();"
n3 = "  // Stratus cloud-streaming games (real cloud gaming)\n  await ensureStratusBase();\n  const cloudGames = await fetchStratusGames();"
assert t.count(o3) == 1, f"init bootstrap x{t.count(o3)}"
t = t.replace(o3, n3, 1)
checks.append("init bootstrap patched")

import os
os.makedirs(os.path.dirname(DST), exist_ok=True)
with open(DST, "w", encoding="utf-8") as f:
    f.write(t)

print("OK →", DST)
for c in checks:
    print("  ✓", c)
print("  size:", len(t))
