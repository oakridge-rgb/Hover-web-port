#!/usr/bin/env python3
"""Patch games.html stage 2: remove fatePlayViaJet, fix ClosePlayer/ReloadGame/newtab/boot/wiring/state."""
import io

PATH = '/home/z/my-project/download/v8.2-deploy/games.html'
src = io.open(PATH, encoding='utf-8').read()

# ---- span: fatePlayViaJet .. before fateNewtabGame -> new ClosePlayer + ReloadGame ----
a = src.find('async function fatePlayViaJet(){')
b = src.find('async function fateNewtabGame(){')
assert a > 0 and b > a, 'anchors missing'
NEW = '''function fateClosePlayer(){
  FATE_PLAY_SEQ++;
  clearTimeout(FATE_HINT_TIMER);
  $id('fatePlayer').classList.add('hidden');
  $id('fateFrameDirect').src = 'about:blank';
  fateRevokeBlob();
  FATE_CURRENT = null;
  document.body.style.overflow = '';
  if (gxView === 'recent') renderGrid(true);
}
function fateReloadGame(){
  if (!FATE_CURRENT) return;
  fatePlay(FATE_CURRENT, FATE_NEED_CODE);
}
'''
src = src[:a] + NEW + src[b:]

# ---- fateNewtabGame: FATE_MODE branches ----
a = src.find('async function fateNewtabGame(){')
b = src.find('function fateFullscreenGame(){')
assert a > 0 and b > a
seg = src[a:b]
old = """    if (FATE_ACTIVE_BLOB && FATE_MODE === 'direct' && g.fetchGame === true){
      const res = await fetch(FATE_ACTIVE_BLOB);
      blob = new Blob([await res.text()], { type: 'text/html' });
    } else if (g.fetchGame === true){"""
new = """    if (FATE_ACTIVE_BLOB && (FATE_NEED_CODE || fateNeedsFetch(g.url))){
      const res = await fetch(FATE_ACTIVE_BLOB);
      blob = new Blob([await res.text()], { type: 'text/html' });
    } else if (fateNeedsFetch(g.url)){"""
assert old in seg, 'newtab branch not found'
seg = seg.replace(old, new)
assert 'FATE_MODE' not in seg
src = src[:a] + seg + src[b:]

# ---- fateArcadeStart: jet stage + warmup out ----
for old, new in [
    ("    fateJetStage('unpacking the vault\\u2026');\n", ''),
    ('    fateJetStage(null);\n', ''),
    ("    /* warm the tunnel in the background (non-fatal \u2014 most games load direct) */\n    setTimeout(() => { try { if (FATE_JET_STATE === 'idle') fateJetBoot(); } catch(e){} }, 1200);\n", ''),
    ("    fateJetStage('catalog problem \\u2014 ' + (e.message || e), 'err');\n", ''),
]:
    assert old in src, 'missing: ' + old[:60]
    src = src.replace(old, new)

# ---- wiring ----
for old, new in [
    ("$id('fatePTunnel').onclick = fatePlayViaJet;", "$id('fatePCode').onclick = fatePlayCode;"),
    ("$id('fatePErrTunnel').onclick = fatePlayViaJet;", "$id('fatePErrCode').onclick = fatePlayCode;"),
]:
    assert old in src, 'missing: ' + old[:60]
    src = src.replace(old, new)

io.open(PATH, 'w', encoding='utf-8').write(src)
print('patched OK,', len(src.split(chr(10))), 'lines')
bad = [t for t in ('FATE_JET', 'fateJetBoot', 'fatePlayViaJet', 'fatePTunnel', 'fatePErrTunnel',
                   'fateFrameJet', 'FATE_MODE', 'fateJetStage', 'FATE_FRAME', 'fateSleep', 'fateSetMode') if t in src]
print('remaining jet refs:', bad or 'NONE')
