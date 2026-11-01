#!/usr/bin/env python3
"""Rebuild Fresh (hard) + Dad Battle (spam) charts from the user's ORIGINAL
SNIFF charts. Preserves: section count, mustHitSection flags, BPM, speed,
song fields, opponent notes. Only PLAYER-side notes are rewritten.

Psych lane convention (verified against the user's originals):
  mustHitSection=True  -> lanes 0-3 = PLAYER, lanes 4-7 = DAD
  mustHitSection=False -> lanes 0-3 = DAD,   lanes 4-7 = PLAYER
"""
import json, math, os, shutil
from collections import Counter

BASE = '/home/z/my-project'
SRC = {
    'fresh':     f'{BASE}/scripts/fresh_orig.json',
    'dadbattle': f'{BASE}/scripts/dadbattle_orig.json',
    'bopeebo':   f'{BASE}/scripts/bopeebo_orig.json',
}
DL = f'{BASE}/download'


def load(p):
    with open(p) as f:
        return json.load(f)


def r3(x):
    return round(x, 3)


def section_starts(song):
    """Cumulative start ms + active bpm per section (honors changeBPM)."""
    t, bpm, out = 0.0, float(song['bpm']), []
    for sec in song['notes']:
        out.append((t, bpm))
        if sec.get('changeBPM'):
            bpm = float(sec.get('bpm', song['bpm']))
        t += sec.get('lengthInSteps', 16) * 60000.0 / bpm / 4.0
    return out


# ---------------- pattern helpers (16-step sections) ----------------

def ks_range(a, b, e=1.0):
    """16th-grid positions k with a <= k < b (never touches the section boundary)."""
    count = int(math.ceil((b - a) / e - 1e-9))
    return [round(a + i * e, 3) for i in range(max(count, 0))]


def seg(t0, step, ks, lane_seq, L):
    return [[r3(t0 + k * step), L[lane_seq[i % len(lane_seq)]], 0]
            for i, k in enumerate(ks)]


def pat_alt(t0, step, L, pair, e=1.0, a=0.0, b=16.0):
    """Alternating two-lane spam."""
    return seg(t0, step, ks_range(a, b, e), [pair[0], pair[1]], L)


def pat_roll(t0, step, L, a=0.0, b=16.0, order=(0, 1, 2, 3)):
    return seg(t0, step, ks_range(a, b, 1.0), list(order), L)


def pat_jack(t0, step, L, lane, e=1.0, a=0.0, b=16.0):
    """Single-lane jackhammer."""
    return [[r3(t0 + k * step), L[lane], 0] for k in ks_range(a, b, e)]


def pat_jumps(t0, step, L, pair, e=2.0, a=0.0, b=16.0):
    """Two-note jumps (jumpjack when on the 16th grid)."""
    out = []
    for k in ks_range(a, b, e):
        t = r3(t0 + k * step)
        out.append([t, L[pair[0]], 0])
        out.append([t, L[pair[1]], 0])
    return out


def pat_burst(t0, step, L, pair, n, a=0.0):
    """n 32nd-notes burst starting at 16th-grid pos a. Returns (notes, resume_k)."""
    out = [[r3(t0 + (a + i * 0.5) * step), L[pair[i % 2]], 0] for i in range(n)]
    return out, a + math.ceil(n / 2.0)


# ---------------- Dad Battle: spam ----------------

def dad_player(ci, pos, clen, ncl, t0, step, L):
    last = (ci == ncl - 1)
    if last:  # finale
        if pos == 0:
            return (pat_jumps(t0, step, L, (0, 3), e=2.0, a=0.0, b=8.0)
                    + pat_alt(t0, step, L, (0, 3), e=1.0, a=8.0, b=16.0))
        return pat_alt(t0, step, L, (0, 3), e=1.0)
    if ci <= 1:  # warmup: 8th-note alternating spam
        return pat_alt(t0, step, L, (0, 3) if pos % 2 == 0 else (1, 2), e=2.0)
    if ci == 2:  # 16th streams begin
        return [pat_alt(t0, step, L, (0, 3)), pat_roll(t0, step, L)][pos % 2]
    if clen >= 6:  # the big wall run: 8 sections of sustained 12 nps
        opts = [lambda: pat_alt(t0, step, L, (0, 3)),
                lambda: pat_jack(t0, step, L, 0),
                lambda: pat_alt(t0, step, L, (1, 2)),
                lambda: pat_jumps(t0, step, L, (0, 3)),
                lambda: pat_roll(t0, step, L),
                lambda: pat_jack(t0, step, L, 3),
                lambda: pat_alt(t0, step, L, (1, 2)),
                lambda: pat_roll(t0, step, L, order=(3, 2, 1, 0))]
        return opts[pos % 8]()
    if ci % 2 == 1:  # jumpjack rounds
        opts = [lambda: pat_jumps(t0, step, L, (1, 2)),
                lambda: pat_alt(t0, step, L, (0, 3)),
                lambda: pat_jack(t0, step, L, 1),
                lambda: pat_jumps(t0, step, L, (0, 3))]
        return opts[pos % 4]()
    # default: full 16th rotation
    opts = [lambda: pat_alt(t0, step, L, (0, 3)),
            lambda: pat_jack(t0, step, L, 2),
            lambda: pat_alt(t0, step, L, (1, 2)),
            lambda: pat_roll(t0, step, L, order=(3, 2, 1, 0))]
    return opts[pos % 4]()


# ---------------- Fresh: harder than Bopeebo ----------------

def fresh_player(ci, pos, clen, ncl, t0, step, L):
    last = (ci == ncl - 1)
    if ci == 0:  # gentle entry: 8ths then a 16th-run second half
        if pos % 2 == 0:
            return (pat_alt(t0, step, L, (0, 3), e=2.0, a=0.0, b=8.0)
                    + pat_roll(t0, step, L, a=8.0))
        return (pat_alt(t0, step, L, (1, 2), e=2.0, a=0.0, b=8.0)
                + pat_alt(t0, step, L, (0, 3), a=8.0))
    if ci == 1:  # full 16th streams (8 nps sustained, already > Bopeebo)
        return [pat_roll(t0, step, L), pat_alt(t0, step, L, (0, 3))][pos % 2]
    # from here on: 32nd burst at the head + 16th/jump tail
    n = [6, 8, 10][(ci - 2) % 3]
    if last:
        n = 10
    pair = [(0, 3), (1, 2)][(ci + pos) % 2]
    burst, resume = pat_burst(t0, step, L, pair, n)
    other = (1, 2) if pair == (0, 3) else (0, 3)
    if ci % 2 == 1:
        tail = pat_jumps(t0, step, L, other, e=2.0, a=resume, b=16.0)
    elif (ci + pos) % 2 == 0:
        tail = pat_roll(t0, step, L, a=resume)
    else:
        tail = pat_alt(t0, step, L, other, a=resume)
    return burst + tail


# ---------------- builder ----------------

def clusters_of(song):
    """Player clusters: consecutive mustHit sections that contain player notes."""
    out, cur = [], []
    for si, sec in enumerate(song['notes']):
        must = bool(sec.get('mustHitSection'))
        pl = (0, 1, 2, 3) if must else (4, 5, 6, 7)
        has_p = any(int(n[1]) in pl for n in (sec.get('sectionNotes') or []))
        if has_p:
            if cur and si != cur[-1] + 1:
                out.append(cur)
                cur = []
            cur.append(si)
        # sections without player notes break nothing; consecutive runs only
    if cur:
        out.append(cur)
    return out


def build(src_path, player_fn, tag):
    top = load(src_path)
    song = top['song']
    starts = section_starts(song)
    cls = clusters_of(song)
    cl_of = {}
    for ci, cl in enumerate(cls):
        for j, si in enumerate(cl):
            cl_of[si] = (ci, j, len(cl), len(cls))
    print(f'[{tag}] clusters ({len(cls)}): {cls}')

    new_secs = []
    gen_count = 0
    for si, sec in enumerate(song['notes']):
        s = dict(sec)
        sn = [list(n) for n in (sec.get('sectionNotes') or [])]
        must = bool(sec.get('mustHitSection'))
        pl = (0, 1, 2, 3) if must else (4, 5, 6, 7)
        dl = (4, 5, 6, 7) if must else (0, 1, 2, 3)
        dad = [n for n in sn if int(n[1]) in dl]
        has_p = any(int(n[1]) in pl for n in sn)
        t0, bpm = starts[si]
        step = 60000.0 / bpm / 4.0
        if has_p:
            ci, pos, clen, ncl = cl_of[si]
            gen = player_fn(ci, pos, clen, ncl, t0, step, list(pl))
            gen_count += len(gen)
            new_sn = sorted(dad + gen, key=lambda n: (float(n[0]), int(n[1])))
        else:
            new_sn = sn
        s['sectionNotes'] = new_sn
        new_secs.append(s)
    song2 = dict(song)
    song2['notes'] = new_secs
    top2 = dict(top)
    top2['song'] = song2
    print(f'[{tag}] generated player notes: {gen_count}')
    return top2


# ---------------- validation ----------------

def audit(tag, top, src_path):
    song = top['song']
    orig = load(src_path)
    orig_song = orig['song']
    errs = []
    if len(song['notes']) != len(orig_song['notes']):
        errs.append('section count mismatch')
    for a, b in zip(song['notes'], orig_song['notes']):
        if bool(a.get('mustHitSection')) != bool(b.get('mustHitSection')):
            errs.append(f"mustHit mismatch @ {orig_song['notes'].index(b)}")
            break
    starts = section_starts(song)
    seen = set()
    dupes = 0
    bad_lane = 0
    bad_time = 0
    player_times = []
    per_sec = []
    for si, sec in enumerate(song['notes']):
        must = bool(sec.get('mustHitSection'))
        pl = (0, 1, 2, 3) if must else (4, 5, 6, 7)
        dl = (4, 5, 6, 7) if must else (0, 1, 2, 3)
        t0, bpm = starts[si]
        step = 60000.0 / bpm / 4.0
        end = t0 + sec.get('lengthInSteps', 16) * step
        sn = sec['sectionNotes']
        sec_p = 0
        for n in sn:
            t, lane, sus = float(n[0]), int(n[1]), float(n[2])
            if not (0 <= lane <= 7):
                bad_lane += 1
            if sus < 0:
                errs.append(f'neg sustain @ {si}')
            if t < t0 - 1.0 or t > end:
                bad_time += 1
            key = (round(t, 1), lane)
            if key in seen:
                dupes += 1
            seen.add(key)
            if lane in pl:
                player_times.append(t)
                sec_p += 1
        per_sec.append((si, sec_p, t0, end))
    times = sorted(player_times)
    peak = 0
    j = 0
    for i in range(len(times)):
        while times[i] - times[j] > 1000.0:
            j += 1
        peak = max(peak, i - j + 1)
    # sustained nps across player-note sections
    densest = max((c / ((e - s) / 1000.0)) for _, c, s, e in per_sec if c > 0)
    print(f'--- AUDIT {tag}: sections={len(song["notes"])} '
          f'total_notes={sum(len(s["sectionNotes"]) for s in song["notes"])} '
          f'player_notes={len(player_times)}')
    print(f'    peak nps(1s window)={peak}  densest section={densest:.2f} nps  '
          f'dupes={dupes} bad_lane={bad_lane} bad_time={bad_time} errs={errs[:5]}')
    assert not errs and dupes == 0 and bad_lane == 0 and bad_time == 0
    return peak, densest, len(player_times)


def baseline_nps(src_path):
    song = load(src_path)['song']
    starts = section_starts(song)
    tot_t, tot_n = 0.0, 0
    for si, sec in enumerate(song['notes']):
        must = bool(sec.get('mustHitSection'))
        pl = (0, 1, 2, 3) if must else (4, 5, 6, 7)
        t0, bpm = starts[si]
        step = 60000.0 / bpm / 4.0
        dur = sec.get('lengthInSteps', 16) * step / 1000.0
        n = sum(1 for x in sec.get('sectionNotes') or [] if int(x[1]) in pl)
        tot_t += dur
        tot_n += n
    return tot_n / tot_t if tot_t else 0


def write(path, obj):
    with open(path, 'w') as f:
        json.dump(obj, f, separators=(',', ':'))
    # re-parse to guarantee validity
    with open(path) as f:
        json.load(f)
    print(f'wrote {path} ({os.path.getsize(path)} bytes)')


if __name__ == '__main__':
    print('Bopeebo baseline (player nps):',
          round(baseline_nps(SRC['bopeebo']), 2))

    fresh = build(SRC['fresh'], fresh_player, 'fresh')
    db = build(SRC['dadbattle'], dad_player, 'dadbattle')

    print()
    audit('fresh-hard', fresh, SRC['fresh'])
    audit('dadbattle-hard', db, SRC['dadbattle'])

    os.makedirs(DL, exist_ok=True)
    write(f'{DL}/fresh-hard.json', fresh)
    write(f'{DL}/dadbattle-hard.json', db)
    write(f'{DL}/dad-battle-hard.json', db)      # alt filename (Psych "Dad Battle" -> dad-battle)
    # overwrite the stale broken files so no bad copy is left around
    write(f'{DL}/dadbattle-spam.json', db)
    # keep the fnf-charts folder copies too
    os.makedirs(f'{DL}/fnf-charts', exist_ok=True)
    write(f'{DL}/fnf-charts/fresh-hard.json', fresh)
    write(f'{DL}/fnf-charts/dadbattle-hard.json', db)
    write(f'{DL}/fnf-charts/dad-battle-hard.json', db)
    print('ALL OK')
