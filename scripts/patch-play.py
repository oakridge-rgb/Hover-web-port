#!/usr/bin/env python3
"""Patch games.html: replace jet play pipeline with CDN play pipeline (line-based, verified)."""
import io

PATH = '/home/z/my-project/download/v8.2-deploy/games.html'
src = io.open(PATH, encoding='utf-8').read()
lines = src.split('\n')

def find(pred, start=0):
    for i in range(start, len(lines)):
        if pred(lines[i]):
            return i
    raise SystemExit('NOT FOUND: ' + str(pred))

# ---- span 1: fateSetMode .. end of fateReloadGame -> new play pipeline ----
a = find(lambda l: l.startswith('function fateSetMode(mode){'))
b = find(lambda l: l.startswith('async function fateNewtabGame(){'), a)
assert 'fateSetMode' in lines[a] and 'fateNewtabGame' in lines[b]

NEW_PLAY = r'''let FATE_NEED_CODE = false; /* last game needed fetch-mode */
function fateArmHint(seq){
  clearTimeout(FATE_HINT_TIMER);
  FATE_HINT_TIMER = setTimeout(() => {
    if (seq === FATE_PLAY_SEQ) fatePStatus('black screen? tap \u24e3 Code \u2014 loads the game over the CDN instead', '');
  }, 7000);
}
function fateRevokeBlob(){
  if (FATE_ACTIVE_BLOB){ try { URL.revokeObjectURL(FATE_ACTIVE_BLOB); } catch(e){} FATE_ACTIVE_BLOB = null; }
}
/* play a game: direct CDN embed, or fetch-the-code+blob for hosts that need it */
async function fatePlay(g, forceCode){
  const seq = ++FATE_PLAY_SEQ;
  FATE_CURRENT = g;
  fateShowErr(false);
  clearTimeout(FATE_HINT_TIMER);
  fateRevokeBlob();
  FATE_NEED_CODE = false;
  $id('fatePlayer').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $id('fatePName').textContent = g.name;
  $id('fatePCode').disabled = false;
  fatePStatus('loading\u2026');
  const frame = $id('fateFrameDirect');
  frame.src = 'about:blank';
  const needCode = forceCode || fateNeedsFetch(g.url);
  if (needCode){
    /* fetch game code -> inject <base> -> local blob (fixes text/plain hosts + X-Frame-Options) */
    try {
      fateShowSpin(true, 'Loading ' + g.name + '\u2026', 'fetching game code from the fastest CDN mirror\u2026');
      const html = await fatePlayableHTML(g, s => { if (seq === FATE_PLAY_SEQ) fateShowSpin(true, 'Loading ' + g.name + '\u2026', s); });
      if (seq !== FATE_PLAY_SEQ) return;
      const blob = new Blob([html], { type: 'text/html' });
      fateRevokeBlob();
      FATE_ACTIVE_BLOB = URL.createObjectURL(blob);
      FATE_NEED_CODE = true;
      fateShowSpin(false);
      frame.src = FATE_ACTIVE_BLOB;
      fatePStatus('running on local code \u2014 straight from the CDN', 'ok');
      fateBumpRecent(g);
      return;
    } catch(err){
      if (seq !== FATE_PLAY_SEQ) return;
      /* host refuses embedding AND code download -> hard error; otherwise fall through to direct embed */
      if (FATE_NO_EMBED.some(rx => rx.test(fateHost(g.url))) && !g.frameFallback){
        fateShowSpin(false);
        fatePStatus('failed \u2014 ' + (err.message || err), 'err');
        fateShowErr(true, 'This game\u2019s host blocks everything', (err.message || err) + '. This library hosts the game on a site that refuses both embedding and code download \u2014 no player can fix that. Pick another game.');
        fateBumpRecent(g);
        return;
      }
      fatePStatus('code fetch failed \u2014 trying direct embed\u2026');
    }
  } else {
    fateShowSpin(true, 'Loading ' + g.name + '\u2026', g.source + ' \u00b7 direct CDN embed');
  }
  /* direct embed */
  if (seq !== FATE_PLAY_SEQ) return;
  fateShowSpin(false);
  frame.src = g.url;
  fatePStatus('direct CDN embed \u00b7 black screen? tap \u24e3 Code', '');
  fateArmHint(seq);
  fateBumpRecent(g);
}
function fatePlayCode(){
  if (FATE_CURRENT) fatePlay(FATE_CURRENT, true);
}
function fateBumpRecent(g){
  const k = gxKey(g);
  recent = [k, ...recent.filter(x => x !== k)].slice(0, 60);
  _lsSet(GX_RECENT_KEY, recent);
}
function fateClosePlayer(){
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

# find end of fateReloadGame (line before fateNewtabGame), but fateBumpRecent/fateClosePlayer/
# fateReloadGame sit between fatePlay end and fateNewtabGame — check what's in the span
span = lines[a:b]
assert any('fateBumpRecent' in l for l in span), 'unexpected span content'
assert any('fateClosePlayer' in l for l in span), 'unexpected span content'
assert any('fateReloadGame' in l for l in span), 'unexpected span content'

lines = lines[:a] + NEW_PLAY.split('\n')[:-1] + lines[b:]

# ---- patch fateNewtabGame: remove FATE_MODE + jet branches ----
src = '\n'.join(lines)
a = src.find('async function fateNewtabGame(){')
b = src.find('function fateFullscreenGame(){')
assert a > 0 and b > a
seg = src[a:b]
seg = seg.replace("""    if (FATE_ACTIVE_BLOB && FATE_MODE === 'direct' && g.fetchGame === true){
      const res = await fetch(FATE_ACTIVE_BLOB);
      blob = new Blob([await res.text()], { type: 'text/html' });
    } else if (g.fetchGame === true){""",
"""    if (FATE_ACTIVE_BLOB && (FATE_NEED_CODE || fateNeedsFetch(g.url))){
      const res = await fetch(FATE_ACTIVE_BLOB);
      blob = new Blob([await res.text()], { type: 'text/html' });
    } else if (fateNeedsFetch(g.url)){""")
assert 'FATE_MODE' not in seg, 'FATE_MODE still in newtabGame'
src = src[:a] + seg + src[b:]
lines = src.split('\n')

# ---- patch fateArcadeStart: remove jet stage + warmup ----
def idx(sub):
    i = src.find(sub)
    assert i > 0, 'missing: ' + sub
    return i

src = src.replace("    fateJetStage('unpacking the vault\\u2026');\n", '')
src = src.replace('    fateJetStage(null);\n', '')
src = src.replace("    /* warm the tunnel in the background (non-fatal \u2014 most games load direct) */\n    setTimeout(() => { try { if (FATE_JET_STATE === 'idle') fateJetBoot(); } catch(e){} }, 1200);\n", '')
src = src.replace("    fateJetStage('catalog problem \\u2014 ' + (e.message || e), 'err');\n", '')

# ---- wiring: tunnel buttons -> code buttons ----
src = src.replace("$id('fatePTunnel').onclick = fatePlayViaJet;", "$id('fatePCode').onclick = fatePlayCode;")
src = src.replace("$id('fatePErrTunnel').onclick = fatePlayViaJet;", "$id('fatePErrCode').onclick = fatePlayCode;")

# ---- state line: FATE_MODE -> FATE_HINT_TIMER ----
src = src.replace("let FATE_ACTIVE_BLOB = null, FATE_CURRENT = null, FATE_PLAY_SEQ = 0, FATE_MODE = 'direct';",
                  "let FATE_ACTIVE_BLOB = null, FATE_CURRENT = null, FATE_PLAY_SEQ = 0, FATE_HINT_TIMER = null;")

io.open(PATH, 'w', encoding='utf-8').write(src)
print('patched OK,', len(src.split(chr(10))), 'lines')

# ---- verify no jet refs remain ----
bad = [t for t in ('FATE_JET', 'fateJetBoot', 'fatePlayViaJet', 'fatePTunnel', 'fatePErrTunnel',
                   'fateFrameJet', 'FATE_MODE', 'fateJetStage', 'FATE_FRAME', 'fateSleep') if t in src]
print('remaining jet refs:', bad or 'NONE')
