#!/usr/bin/env python3
"""FUNKIN' HARD chart builder
- Bopeebo: kept exactly as provided (song 1, the baseline)
- Fresh:   hardened until clearly harder than Bopeebo  -> fresh-hard.json
- DadBattle: converted to a full spam chart            -> dadbattle-spam.json
Also emits charts.js with embedded play data (player/opp note arrays + music tables).
"""
import json, os, bisect
from collections import defaultdict

BASE = '/home/z/my-project/scripts'
OUT  = '/home/z/my-project/scripts/out'
os.makedirs(OUT, exist_ok=True)

def load(name):
    return json.load(open(f'{BASE}/{name}'))['song']

def parse(song):
    """Split chart into player (p) and opponent (o) note lists [ms, lane, sustain]."""
    P, O = [], []
    for sec in song['notes']:
        mh = sec['mustHitSection']
        for nt in sec['sectionNotes']:
            t = round(float(nt[0])); d = int(nt[1]); sus = int(round(float(nt[2])))
            if d >= 4:            O.append([t, d - 4, sus])   # explicit opponent note
            elif mh:              P.append([t, d, sus])       # player side
            else:                 O.append([t, d, sus])       # opponent side
    P.sort(); O.sort()
    return P, O

PAIR = {0: 3, 1: 2, 2: 1, 3: 0}

def finalize(notes, min_gap=70, max_sim=2):
    """Sort + dedupe: one note per lane per time, max 2 simultaneous,
    same lane must be >= min_gap apart. prio (original chart) notes win."""
    byT = defaultdict(list)
    for n in notes: byT[n[0]].append(n)
    res = []; last = {}
    for t in sorted(byT):
        grp = sorted(byT[t], key=lambda n: not n[3])  # prio first
        seen = set(); g2 = []
        for n in grp:
            if n[1] in seen: continue
            seen.add(n[1]); g2.append(n)
        for n in g2[:max_sim]:
            l = n[1]
            if l in last and t - last[l] < min_gap: continue
            last[l] = t
            res.append([t, l, n[2]])
    res.sort()
    return res

def densify_cap(res, cap14=14):
    """Sliding 500ms density cap: drop non-prio... (post-finalize trim of extras)."""
    # res entries [t,l,s] ; we re-run cap by removing latest notes in overfull windows
    changed = True
    while changed:
        changed = False
        ts = [n[0] for n in res]
        for i, t in enumerate(ts):
            j = bisect.bisect_right(ts, t + 500)
            if j - i > cap14:
                # remove the last non-anchor note in window (highest t)
                for k in range(j - 1, i, -1):
                    if res[k][3] is False:
                        res.pop(k); changed = True; break
                else:
                    res.pop(j - 1); changed = True
                break
    return res

# ---------------------------------------------------------------- FRESH HARD
def harden_fresh(P, O):
    S = 2000; out = []
    for i in range(42):
        a = i * S
        psec = [[t, l, s, True] for t, l, s in P if a <= t < a + S]
        osec = [[t, l, s, True] for t, l, s in O if a <= t < a + S]
        add = []
        def A(t, l, sus=0): add.append([t, l, sus, False])
        def pat(t0, labs, step=125):
            for k, l in enumerate(labs): A(t0 + k * step, l)
        if i in (1, 3):                       # verse: jumps on downbeats
            for t, l, s, _ in psec:
                if t % 500 == 0: A(t, PAIR[l])
        if i == 2:                            # dad section: echo alternate notes
            for k, (t, l, s, _) in enumerate(osec):
                if k % 2 == 0: A(t, l)
        if i == 3 and psec:                   # jack out
            A(psec[-1][0] + 125, psec[-1][1])
        if i == 4:  pat(a, [0,1,2,3,0,1,2,3]); pat(a+1000, [3,2,1,0,3,2,1,0])
        if i == 5:  pat(a, [0,0,1,1,2,2,3,3]); pat(a+1000, [3,2,1,0,3,2,1,0])
        if i == 6:  pat(a, [0,3,0,3,0,3,0,3]); pat(a+1000, [1,2,1,2,1,2,1,2])
        if i == 7:  pat(a, [3,3,2,2,1,1,0,0]); pat(a+1000, [0,2,1,3,0,2,1,3])
        if i == 8:  pat(a, [0,1,2,3,0,1,2,3]); pat(a+1000, [3,2,1,0,3,2,1,0])
        if i == 9:  pat(a, [0,2,1,3,0,2,1,3]); pat(a+1000, [0,3,1,2,3,0,2,1])
        if i == 10: pat(a, [1,2,1,2,1,2,1,2]); pat(a+1000, [3,0,3,0,3,0,3,0])
        if i == 11: pat(a, [0,0,1,1,2,2,3,3]); pat(a+1000, [0,1,2,3,0,1,2,3])
        if i in (12,14,16,18,20,22,24,26,28,30,32,34):   # mirror dad -> player
            for t, l, s, _ in osec: A(t, l)
        if i in (13,15,17,19,21,23,25,27,37,39):         # densify 8ths->16ths + jumps
            for k in range(len(psec) - 1):
                A1, B1 = psec[k], psec[k+1]
                if B1[0] - A1[0] == 250:
                    l = (A1[1] + 1) % 4
                    if l == B1[1]: l = (A1[1] + 3) % 4
                    A(A1[0] + 125, l)
            for t, l, s, _ in psec:
                if t % 500 == 0: A(t, PAIR[l])
        if i in (25, 27):                                # beat jacks
            for t, l, s, _ in psec:
                if t % 500 == 0: A(t + 125, l)
        if i == 31: pat(a, [0,1,2,3,0,0,3,2,1,0,3,2,1,1,2,3])
        if i == 33: pat(a, [3,2,1,0,3,3,0,1,2,3,0,1,2,2,1,0])
        if i == 35: pat(a, [0,1,2,3,2,1,0,2,3,1,0,3,2,3,1,2])
        if i in (36, 38):                                # unison jackhammer climax
            labs = [0,0,3,3,1,1,2,2,0,0,3,3,1,1,2,2] if i == 36 else \
                   [1,2,1,2,0,3,0,3,1,2,1,2,0,3,0,3]
            pat(a, labs)
            A(a, PAIR[labs[0]]); A(a + 1000, PAIR[labs[8]])
        if i == 29:                                      # breather: jumps only
            for t, l, s, _ in psec:
                if t % 500 == 0: A(t, PAIR[l])
        if i == 40:                                      # final chord + hold
            add.append([a, 0, 400, False]); add.append([a, 3, 400, False])
        out.extend(psec); out.extend(add)
    return finalize(out)

# ------------------------------------------------------------ DAD BATTLE SPAM
SPAM_PATS = [
    [0,1,2,3,0,1,2,3],   # roll
    [3,2,1,0,3,2,1,0],   # roll back
    [0,3,0,3,0,3,0,3],   # trill 0-3
    [1,2,1,2,1,2,1,2],   # trill 1-2
    [0,0,1,1,2,2,3,3],   # double jacks
    [0,2,1,3,0,2,1,3],   # zigzag
]
CLIMAX = {23, 31, 47, 51, 62, 63}   # unison walls + final wall

def spam_dadbattle(P, O):
    S = 24000.0 / 18.0          # 1333.333 ms section
    step = S / 16.0             # 83.333 ms step
    merged = sorted([[t, l, s, True] for t, l, s in P + O])
    out = []
    for i in range(66):
        a = i * S
        sec = [n for n in merged if a <= n[0] < a + S]
        if not sec:
            if i == 7:          # intro warning roll
                for k, l in enumerate([0,1,2,3,0,1,2,3]):
                    out.append([round(a + (8 + k) * step), l, 0, False])
            if i == 64:         # finale chord + holds
                out.append([round(a), 0, 500, False]); out.append([round(a), 3, 500, False])
            continue
        t0, t1 = sec[0][0], sec[-1][0]
        k0 = int(round((t0 - a) / step)); k1 = int(round((t1 - a) / step))
        span = k1 - k0 + 1
        patA = SPAM_PATS[i % 6]; patB = SPAM_PATS[(i + 2) % 6]
        climax = i in CLIMAX
        for k in range(span):
            g = k0 + k
            if not climax and i % 8 == 7 and k >= span - 3:   # tiny breather notch
                continue
            l = patA[k % 8] if k < span / 2 else patB[k % 8]
            out.append([round(a + g * step), l, 0, False])
        if climax:            # jump walls on quarter beats
            for q in (0, 4, 8, 12):
                g = a + q * step
                cand = [n for n in sec if abs(n[0] - g) < step]
                if cand:
                    out.append([round(g), PAIR[cand[0][1]], 0, False])
                else:
                    out.append([round(g), q % 4, 0, False])
                    out.append([round(g), PAIR[q % 4], 0, False])
        out.extend(sec)
    res = finalize(out, min_gap=78)
    return densify_cap(res, 14)

# ------------------------------------------------------------------- stats
def stats(P, dur_ms, name):
    n = len(P)
    ts = sorted(x[0] for x in P)
    peak1 = peak2 = 0
    for i, t in enumerate(ts):
        peak1 = max(peak1, bisect.bisect_right(ts, t + 1000) - i)
        peak2 = max(peak2, bisect.bisect_right(ts, t + 500) - i)
    holds = sum(1 for x in P if x[2] > 0)
    six = 0
    for k in range(1, len(P)):
        if 100 <= P[k][0] - P[k-1][0] <= 150: six += 1
    print(f'{name:<28} notes={n:<5} avgNPS={n/(dur_ms/1000):5.2f} '
          f'peak1s={peak1:<3} peak0.5s={peak2:<3} holds={holds} 16thGaps={six}')

# ------------------------------------------------------------------- export
def write_json_chart(song_meta, P, O, sec_len, n_sec, fname, generated):
    secs = []
    for i in range(n_sec):
        a = i * sec_len
        p = [[t, l, s] for t, l, s in P if a <= t < a + sec_len]
        o = [[t, l + 4, s] for t, l, s in O if a <= t < a + sec_len]
        notes = sorted(p + o)
        secs.append({"lengthInSteps": 16, "mustHitSection": len(p) > 0,
                     "sectionNotes": notes})
    obj = {"song": {"song": song_meta['song'], "bpm": song_meta['bpm'],
                    "needsVoices": True, "player1": "bf", "player2": "dad",
                    "speed": song_meta['speed'], "notes": secs,
                    "generatedBy": generated}}
    json.dump(obj, open(f'{OUT}/{fname}', 'w'))

def js_arr(x):
    return json.dumps(x, separators=(',', ':'))

def main():
    bop = load('bopeebo_orig.json')
    fr  = load('fresh_orig.json')
    db  = load('dadbattle_orig.json')

    bopP, bopO = parse(bop)
    frP,  frO  = parse(fr)
    dbP,  dbO  = parse(db)

    frH  = harden_fresh(frP, frO)
    dbS  = spam_dadbattle(dbP, dbO)

    print('=== difficulty comparison ===')
    stats(bopP, 79000, 'BOPEEBO (as provided)')
    stats(frH, 83000, 'FRESH HARD')
    stats(dbS, 88500, 'DAD BATTLE SPAM')

    frH3 = [[t, l, s] for t, l, s in frH]
    dbS3 = [[t, l, s] for t, l, s in dbS]

    # Psych-format exports
    write_json_chart({'song': 'Fresh', 'bpm': 120.0, 'speed': 1.8}, frH3, frO,
                     2000, 42, 'fresh-hard.json', 'HARD-ifier ver.1 (FUNKIN HARD)')
    write_json_chart({'song': 'Dad Battle', 'bpm': 180.0, 'speed': 2.3}, dbS3, dbO,
                     round(24000/18, 4), 66, 'dadbattle-spam.json', 'SPAM-ifier ver.1 (FUNKIN HARD)')

    # embedded game data
    prog = {
        'bopeebo':  {'roots': [41, 44, 39, 46],
                     'chords': [[53,56,60],[56,60,63],[55,58,62],[58,62,65]],
                     'vbf': 65, 'vdad': 53},
        'fresh':    {'roots': [45, 41, 48, 43],
                     'chords': [[57,60,64],[53,57,60],[55,60,64],[55,59,62]],
                     'vbf': 57, 'vdad': 45},
        'dadbattle': {'roots': [40, 48, 43, 50],
                      'chords': [[52,55,59],[55,60,64],[55,59,62],[54,57,62]],
                      'vbf': 64, 'vdad': 52},
    }
    ilvl = {
        'bopeebo': [1]*4 + [2]*12 + [3]*14 + [4, 4],
        'fresh':   [1]*4 + [2]*8 + [3]*16 + [2, 2] + [4]*10 + [5, 5],
    }
    dbI = [1]*4 + [2]*4
    for i in range(8, 64): dbI.append(4 if i in CLIMAX else 3)
    dbI.append(4)   # s64 finale
    dbI.append(5)   # s65 outro
    ilvl['dadbattle'] = dbI

    charts = {
        'bopeebo':  {'id': 'bopeebo', 'name': 'BOPEEBO', 'tag': '', 'lv': 3,
                     'bpm': 100, 'speed': 2.1, 'len': 79000, 'p': bopP, 'o': bopO},
        'fresh':    {'id': 'fresh', 'name': 'FRESH', 'tag': 'HARD', 'lv': 7,
                     'bpm': 120, 'speed': 1.8, 'len': 83000, 'p': frH3, 'o': frO},
        'dadbattle': {'id': 'dadbattle', 'name': 'DAD BATTLE', 'tag': 'SPAM', 'lv': 10,
                      'bpm': 180, 'speed': 2.3, 'len': 88500, 'p': dbS3, 'o': dbO},
    }
    with open(f'{OUT}/charts.js', 'w') as f:
        f.write('const PROG=' + js_arr(prog) + ';\n')
        f.write('const ILVL=' + js_arr(ilvl) + ';\n')
        f.write('const CHARTS=' + js_arr(charts) + ';\n')
    print('\nwrote', f'{OUT}/charts.js', os.path.getsize(f'{OUT}/charts.js'), 'bytes')
    print('wrote', f'{OUT}/fresh-hard.json', os.path.getsize(f'{OUT}/fresh-hard.json'), 'bytes')
    print('wrote', f'{OUT}/dadbattle-spam.json', os.path.getsize(f'{OUT}/dadbattle-spam.json'), 'bytes')

    # sanity: check no same-lane violations
    for nm, arr, gap in (('bopeebo', bopP, 0), ('fresh', frH3, 70), ('dadbattle', dbS3, 78)):
        last = {}
        bad = 0
        for t, l, s in arr:
            if l in last and t - last[l] < gap: bad += 1
            last[l] = t
        print(f'{nm}: same-lane gap violations={bad}')
        # simultaneous count check
        byT = defaultdict(int)
        for t, l, s in arr: byT[t] += 1
        mx = max(byT.values())
        print(f'{nm}: max simultaneous notes={mx}')

if __name__ == '__main__':
    main()
