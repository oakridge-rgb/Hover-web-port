#!/usr/bin/env python3
"""
patch_games_voting.py — add the FATE vote system to download/site/games.html.

Adds:
  1. "Votes" chip in the quick-actions row (live total badge)
  2. Hard-lock vote gate (once per session) intercepting openGame/openGameInNewTab
  3. Poll backend: Firestore (polls/current + voters), auto-fallback to local mode
  4. Results modal with live percentage bars + winner banner
Idempotent: refuses to run twice.
"""
import re, shutil, sys

PATH = '/home/z/my-project/download/site/games.html'
src = open(PATH, encoding='utf-8').read()

if 'FATE VOTE SYSTEM' in src:
    print('ALREADY PATCHED — aborting.')
    sys.exit(1)

orig = src
n = 0

def sub_once(old, new, what):
    global src, n
    if old not in src:
        print(f'ANCHOR MISSING: {what}')
        sys.exit(2)
    src = src.replace(old, new, 1)
    n += 1
    print(f'  patched: {what}')

# ---------------------------------------------------------------- 1. chip
sub_once(
    """      Shortcuts
    </button>
  </div>""",
    """      Shortcuts
    </button>
    <button class="q-btn" onclick="if(window.FateVote)FateVote.openResults()" title="Live vote results">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.9v14h-2.9V5zm5.6 8H19v6h-2.9v-6zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>
      Votes <span class="fv-chip-badge" id="fvChipCount">0</span>
    </button>
  </div>""",
    'Votes chip in quick-actions')

# ---------------------------------------------------------------- 2. gate hooks
sub_once(
    """function openGame(id){
  const g = allGames.find(x=>x.id===id);""",
    """function openGame(id){
  if(window.FateVote && FateVote.needsGate()){ FateVote.hold(function(){ openGameReal(id); }); return; }
  openGameReal(id);
}
function openGameReal(id){
  const g = allGames.find(x=>x.id===id);""",
    'openGame gate hook')

sub_once(
    """async function openGameInNewTab(){
  if(!currentGame) return;""",
    """async function openGameInNewTab(){
  if(window.FateVote && FateVote.needsGate()){ FateVote.hold(function(){ openGameInNewTabReal(); }); return; }
  openGameInNewTabReal();
}
async function openGameInNewTabReal(){
  if(!currentGame) return;""",
    'openGameInNewTab gate hook')

# ---------------------------------------------------------------- 3. the system
BLOCK = r'''
<!-- ===== FATE VOTE SYSTEM (hard session gate + Firestore polls) v1 ===== -->
<style>
.fv-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(3,5,10,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px}
.fv-card{width:100%;max-width:540px;background:rgba(10,14,26,.97);border:1px solid rgba(245,158,11,.4);border-radius:22px;padding:26px 26px 22px;box-shadow:0 30px 90px rgba(0,0,0,.7),0 0 60px rgba(245,158,11,.12);font-family:"Inter",sans-serif;color:#f8fafc}
.fv-brand{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.fv-logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#ef4444);display:flex;align-items:center;justify-content:center;font-weight:800;font-family:"Space Grotesk",sans-serif;color:#fff;box-shadow:0 0 18px rgba(245,158,11,.45)}
.fv-brand span{font-size:.72rem;font-weight:800;letter-spacing:.22em;color:#fbbf24}
.fv-q{font-family:"Space Grotesk",sans-serif;font-size:1.35rem;font-weight:700;letter-spacing:-.02em;line-height:1.25;margin-bottom:6px}
.fv-sub{font-size:.8rem;color:#94a3b8;line-height:1.5;margin-bottom:18px}
.fv-options{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.fv-opt{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:13px 16px;color:#f8fafc;font-size:.95rem;font-weight:600;cursor:pointer;transition:all .2s ease;font-family:inherit}
.fv-opt:hover:not(:disabled){border-color:rgba(245,158,11,.6);background:rgba(245,158,11,.1);transform:translateY(-1px)}
.fv-opt:disabled{opacity:.55;cursor:wait}
.fv-opt.mine{border-color:rgba(245,158,11,.7);background:rgba(245,158,11,.12)}
.fv-opt.lead{border-color:rgba(16,185,129,.55)}
.fv-key{width:26px;height:26px;border-radius:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);color:#fbbf24;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;flex-shrink:0}
.fv-pct{margin-left:auto;font-size:.8rem;font-weight:700;color:#fbbf24;flex-shrink:0}
.fv-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:8px}
.fv-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#f59e0b,#fbbf24);width:0;transition:width .6s cubic-bezier(.4,0,.2,1)}
.fv-foot{font-size:.72rem;color:#64748b;text-align:center;line-height:1.5}
.fv-foot b{color:#fbbf24}
.fv-winner{margin:2px 0 14px;padding:10px 14px;border-radius:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.35);color:#6ee7b7;font-size:.85rem;font-weight:600;text-align:center}
.fv-total{display:flex;justify-content:space-between;font-size:.72rem;color:#94a3b8;margin-top:4px}
.fv-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#94a3b8;width:32px;height:32px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
.fv-close:hover{color:#fff;border-color:rgba(245,158,11,.5)}
.fv-card.fv-results{position:relative}
.fv-chip-badge{margin-left:2px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.45);color:#fbbf24;font-size:.68rem;font-weight:800;border-radius:99px;padding:1px 8px;min-width:20px;text-align:center}
.fv-skel{height:46px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04));background-size:200% 100%;animation:fvsk 1.2s infinite}
@keyframes fvsk{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media (max-width:600px){.fv-card{padding:20px 16px 16px}.fv-q{font-size:1.1rem}}
</style>

<div class="fv-overlay" id="fvGate" style="display:none">
  <div class="fv-card" role="dialog" aria-modal="true">
    <div class="fv-brand"><div class="fv-logo">F</div><span>FATE VOTES</span></div>
    <div class="fv-q" id="fvQuestion">Loading poll&hellip;</div>
    <p class="fv-sub">Vote to unlock games for this session. Your pick decides what gets added next &mdash; one vote per player.</p>
    <div class="fv-options" id="fvOptions"></div>
    <div class="fv-foot" id="fvFoot">This vote is <b>required to play</b>. It takes two seconds.</div>
  </div>
</div>

<div class="fv-overlay" id="fvResults" style="display:none">
  <div class="fv-card fv-results" role="dialog" aria-modal="true">
    <button class="fv-close" onclick="if(window.FateVote)FateVote.closeResults()" aria-label="Close"><svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    <div class="fv-brand"><div class="fv-logo">F</div><span>FREE VOTE RESULTS</span></div>
    <div class="fv-q" id="fvRQuestion"></div>
    <div class="fv-winner" id="fvWinner">&nbsp;</div>
    <div class="fv-options" id="fvBars"></div>
    <div class="fv-total"><span id="fvRTotal">0 votes</span><span id="fvRMode"></span></div>
  </div>
</div>

<script type="module">
/* ===== FATE VOTE SYSTEM v1 — Firestore polls + hard session gate ===== */
/* +------------------------------------------------------------------+
   | PASTE YOUR FIREBASE WEB CONFIG HERE                              |
   | (Firebase console > Project settings > General > Your apps >     |
   |  SDK setup and configuration > Config). Leave apiKey empty to    |
   | run in LOCAL mode (counts stay per-browser).                     |
   +------------------------------------------------------------------+ */
const FATE_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const DEFAULT_POLL = { question: 'Which game should FATE add next?', options: ['Smash Karts', 'Retro Bowl', 'Bloxd.io'] };
const LS_COUNTS = 'fate_poll_counts_v1';
const LS_MY = 'fate_poll_mychoice_v1';
const LS_VOTED = 'fate_poll_voted_round';
const SS_KEY = 'fate_vote_done';

const $ = (id) => document.getElementById(id);
const S = { mode: 'local', fs: null, db: null, auth: null, poll: null, round: null,
            counts: null, myChoice: null, pending: null, gateOpen: false, resultsOpen: false,
            unsub: null, ready: false };

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
const fvHash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };

function defaultRound(p) { return 'd' + fvHash(p.question + '|' + p.options.join(',')); }
function total() { return (S.counts || []).reduce((a, b) => a + b, 0); }

/* ---------- Firestore wiring ---------- */
async function initFirebase() {
  if (!FATE_FIREBASE_CONFIG.apiKey) return false;
  try {
    const V = '11.6.0';
    const [appM, authM, fsM] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/' + V + '/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/' + V + '/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/' + V + '/firebase-firestore.js')
    ]);
    const app = appM.initializeApp(FATE_FIREBASE_CONFIG);
    S.fs = fsM; S.db = fsM.getFirestore(app); S.auth = authM.getAuth(app);
    await authM.signInAnonymously(S.auth);
    S.mode = 'firebase';
    return true;
  } catch (e) {
    console.warn('[FateVote] Firebase unavailable, staying in local mode:', e && e.message);
    return false;
  }
}

async function loadPoll() {
  let poll = DEFAULT_POLL, round = defaultRound(DEFAULT_POLL), fromDoc = false;
  if (S.mode === 'firebase') {
    try {
      const { getDoc, doc } = S.fs;
      const snap = await getDoc(doc(S.db, 'polls', 'current'));
      if (snap.exists()) {
        const d = snap.data() || {};
        if (d.active === false) { /* keep default */ }
        else if (Array.isArray(d.options) && d.options.length >= 2 && d.options.length <= 12) {
          poll = { question: String(d.question || DEFAULT_POLL.question), options: d.options.map((o) => String(o)) };
          round = 'f' + (d.updatedAt != null ? String(d.updatedAt) : defaultRound(poll));
          fromDoc = true;
        }
      }
    } catch (e) { console.warn('[FateVote] poll doc read failed:', e && e.message); }
  }
  S.poll = poll; S.round = round;
  S.counts = poll.options.map(() => 0);
  S.myChoice = null;

  if (S.mode === 'firebase') {
    try {
      const { getDoc, doc, collection, onSnapshot } = S.fs;
      const uid = S.auth.currentUser && S.auth.currentUser.uid;
      if (uid) {
        const my = await getDoc(doc(S.db, 'polls', 'current', 'voters', uid + '__' + round));
        if (my.exists()) S.myChoice = Math.max(0, Number(my.data().choice) | 0);
      }
      S.unsub = onSnapshot(collection(S.db, 'polls', 'current', 'voters'), (snap) => {
        const c = S.poll.options.map(() => 0);
        snap.forEach((d) => {
          const v = d.data() || {};
          if (String(v.round) !== S.round) return;
          const ch = Number(v.choice) | 0;
          if (ch >= 0 && ch < c.length) c[ch]++;
        });
        S.counts = c; updateChip();
        if (S.resultsOpen) renderResults();
      }, (err) => console.warn('[FateVote] live tally unavailable:', err && err.message));
      if (S.myChoice != null) ssSet(SS_KEY, S.round);   // already voted this round: never re-gate
    } catch (e) { console.warn('[FateVote] vote state check failed:', e && e.message); }
  } else {
    // local mode
    try {
      const o = JSON.parse(lsGet(LS_COUNTS) || 'null');
      if (o && o.round === round && Array.isArray(o.counts)) S.counts = o.counts.map((x) => +x || 0);
      const m = JSON.parse(lsGet(LS_MY) || 'null');
      if (lsGet(LS_VOTED) === round && m && m.round === round) S.myChoice = Math.max(0, Number(m.choice) | 0);
    } catch (e) {}
    updateChip();
  }
  S.ready = true;
}

/* ---------- chip + results ---------- */
function updateChip() { const el = $('fvChipCount'); if (el) el.textContent = String(total()); }

function openResults() {
  if (!S.ready) { setTimeout(openResults, 250); return; }
  S.resultsOpen = true; renderResults(); $('fvResults').style.display = 'flex';
}
function closeResults() { S.resultsOpen = false; $('fvResults').style.display = 'none'; }

function renderResults() {
  $('fvRQuestion').textContent = S.poll.question;
  const t = total();
  let lead = -1, leadN = 0;
  S.counts.forEach((c, i) => { if (c > leadN) { leadN = c; lead = i; } });
  $('fvWinner').innerHTML = t > 0
    ? 'Leading: ' + esc(S.poll.options[lead]) + ' &mdash; ' + Math.round(leadN / t * 100) + '% of ' + t + ' vote' + (t === 1 ? '' : 's')
    : 'No votes yet &mdash; yours decides the winner.';
  $('fvBars').innerHTML = S.poll.options.map((name, i) => {
    const pct = t ? Math.round((S.counts[i] || 0) / t * 100) : 0;
    const cls = 'fv-opt' + (i === lead && t > 0 ? ' lead' : '') + (S.myChoice === i ? ' mine' : '');
    return '<button class="' + cls + '" disabled><span class="fv-key">' + String.fromCharCode(65 + i) + '</span>' +
      '<span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) +
      '<span class="fv-bar"><i style="width:' + pct + '%"></i></span></span>' +
      '<span class="fv-pct">' + pct + '%</span></button>';
  }).join('');
  $('fvRTotal').textContent = t + ' vote' + (t === 1 ? '' : 's');
  $('fvRMode').textContent = S.mode === 'firebase' ? 'Live - Firestore' : 'This browser only (local mode)';
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- hard gate ---------- */
function needsGate() {
  if (!S.ready || !S.poll) return false;
  if (S.myChoice != null) { ssSet(SS_KEY, S.round); return false; }
  return ssGet(SS_KEY) !== S.round;
}
function hold(cb) { S.pending = cb || null; showGate(); }

function showGate() {
  if (S.gateOpen) return;
  if (!S.ready) { setTimeout(showGate, 250); return; }
  if (!needsGate()) { const cb = S.pending; S.pending = null; if (cb) cb(); return; }
  S.gateOpen = true;
  renderGate();
  $('fvGate').style.display = 'flex';
  document.addEventListener('keydown', blockKeys, true);
}
function blockKeys(e) {
  if (S.resultsOpen) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeResults(); } return; }
  if (S.gateOpen) { e.preventDefault(); e.stopPropagation(); }
}
function renderGate() {
  $('fvQuestion').textContent = S.poll.question;
  $('fvOptions').innerHTML = S.poll.options.map((name, i) =>
    '<button class="fv-opt" data-i="' + i + '"><span class="fv-key">' + String.fromCharCode(65 + i) + '</span>' +
    '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span></button>').join('');
  $('fvOptions').querySelectorAll('.fv-opt').forEach((b) => {
    b.addEventListener('click', () => vote(Number(b.dataset.i)));
  });
  $('fvFoot').innerHTML = S.mode === 'firebase'
    ? 'This vote is <b>required to play</b>. It takes two seconds.'
    : 'This vote is <b>required to play</b>. <span style="color:#fbbf24">Local mode</span> - add your Firebase config to share votes.';
}

async function vote(i) {
  if (!S.gateOpen || S.myChoice != null) return;
  const btns = $('fvOptions').querySelectorAll('.fv-opt');
  btns.forEach((b) => { b.disabled = true; });
  $('fvFoot').textContent = 'Saving your vote...';
  let ok = false;
  if (S.mode === 'firebase') {
    try {
      const { setDoc, doc, serverTimestamp } = S.fs;
      const uid = S.auth.currentUser && S.auth.currentUser.uid;
      await setDoc(doc(S.db, 'polls', 'current', 'voters', (uid || 'anon') + '__' + S.round),
        { choice: i, round: S.round, at: serverTimestamp() });
      ok = true;
    } catch (e) {
      console.warn('[FateVote] cloud vote rejected, counting locally instead:', e && e.message);
    }
  }
  if (!ok) {
    S.counts[i] = (S.counts[i] || 0) + 1;
    lsSet(LS_COUNTS, JSON.stringify({ round: S.round, counts: S.counts }));
    lsSet(LS_VOTED, S.round);
    lsSet(LS_MY, JSON.stringify({ round: S.round, choice: i }));
  }
  S.myChoice = i;
  ssSet(SS_KEY, S.round);
  updateChip();
  $('fvFoot').innerHTML = '<b>Vote counted</b> - starting your game...';
  setTimeout(releaseGate, 700);
}

function releaseGate() {
  S.gateOpen = false;
  $('fvGate').style.display = 'none';
  document.removeEventListener('keydown', blockKeys, true);
  const cb = S.pending; S.pending = null;
  if (cb) { try { cb(); } catch (e) { console.error(e); } }
}

/* ---------- boot ---------- */
(async () => {
  const ok = await initFirebase();
  await Promise.race([loadPoll(), new Promise((r) => setTimeout(r, 6000))]);   // never hang the gate
  if (!S.poll) { S.poll = DEFAULT_POLL; S.round = defaultRound(DEFAULT_POLL); S.counts = S.poll.options.map(() => 0); S.mode = 'local'; S.ready = true; }
  updateChip();
  setTimeout(() => { if (needsGate()) hold(null); }, 900);                     // gate on page open, once per session
  console.log('[FateVote] ready - mode:', S.mode, '- poll:', S.poll.question);
})();

window.FateVote = { needsGate, hold, openResults, closeResults,
  state: () => ({ mode: S.mode, round: S.round, total: total(), myChoice: S.myChoice, poll: S.poll }) };
</script>
<!-- ===== END FATE VOTE SYSTEM ===== -->
'''
sub_once('<script src="fate-extras.js" defer></script>',
         BLOCK + '\n<script src="fate-extras.js" defer></script>',
         'vote system block (CSS + HTML + module)')

assert src != orig
open(PATH, 'w', encoding='utf-8').write(src)
print(f'DONE — {n} anchors patched, {len(src)} bytes now')
