#!/usr/bin/env python3
"""fix_games_voting_v2.py — per-session re-confirmation semantics.

1. needsGate(): gate every new session (drop the already-voted auto-release)
2. vote(): firebase path moves an existing ballot (updateDoc choice-only) or creates one
3. local path: move the vote instead of double-counting
4. rules: allow same-owner choice-only update within the same round
"""
PATH = '/home/z/my-project/download/site/games.html'
src = open(PATH, encoding='utf-8').read()

R = []
def rep(old, new, what):
    global src
    if old not in src:
        print(f'MISSING: {what}'); exit(2)
    src = src.replace(old, new, 1); R.append(what)
    print(f'  fixed: {what}')

rep(
    """      if (S.myChoice != null) ssSet(SS_KEY, S.round);   // already voted this round: never re-gate
""",
    "",
    'loadPoll: drop already-voted session release')

rep(
    """function needsGate() {
  if (!S.ready || !S.poll) return false;
  if (S.myChoice != null) { ssSet(SS_KEY, S.round); return false; }
  return ssGet(SS_KEY) !== S.round;
}""",
    """function needsGate() {
  if (!S.ready || !S.poll) return false;
  return ssGet(SS_KEY) !== S.round;   // every new session asks again
}""",
    'needsGate: per-session semantics')

rep(
    """      const { setDoc, doc, serverTimestamp } = S.fs;
      const uid = S.auth.currentUser && S.auth.currentUser.uid;
      await setDoc(doc(S.db, 'polls', 'current', 'voters', (uid || 'anon') + '__' + S.round),
        { choice: i, round: S.round, at: serverTimestamp() });
      ok = true;""",
    """      const { setDoc, updateDoc, doc, serverTimestamp } = S.fs;
      const uid = S.auth.currentUser && S.auth.currentUser.uid;
      const ref = doc(S.db, 'polls', 'current', 'voters', (uid || 'anon') + '__' + S.round);
      try {                                   // ballot exists: move it (choice only)
        await updateDoc(ref, { choice: i });
        ok = true;
      } catch (e2) {                          // first vote this round: create it
        await setDoc(ref, { choice: i, round: S.round, at: serverTimestamp() });
        ok = true;
      }""",
    'vote(): create-or-move ballot')

rep(
    """  if (!ok) {
    S.counts[i] = (S.counts[i] || 0) + 1;""",
    """  if (!ok) {
    if (S.myChoice != null && S.myChoice !== i) S.counts[S.myChoice] = Math.max(0, (S.counts[S.myChoice] || 0) - 1); // move, not duplicate
    S.counts[i] = (S.counts[i] || 0) + 1;""",
    'local vote: move instead of double-count')

assert src != open(PATH, encoding='utf-8').read()
open(PATH, 'w', encoding='utf-8').write(src)
print(f'DONE — {len(R)} fixes applied')

# ---- rules file ----
RP = '/home/z/my-project/download/site/firestore.rules'
rules = open(RP, encoding='utf-8').read()
old_rules = """    // Ballots: one doc per player per poll round, id = <uid>__<round>.
    // Create-only means a player can cast exactly one ballot per round;
    // nobody (not even the same player) can edit or delete a ballot.
    match /polls/{pollId}/voters/{ballotId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.keys().hasOnly(['choice', 'round', 'at'])
                    && request.resource.data.choice is int
                    && request.resource.data.choice >= 0
                    && request.resource.data.choice < 32
                    && request.resource.data.round is string;
      allow update, delete: if false;
    }"""
new_rules = """    // Ballots: one doc per player per poll round, id = <uid>__<round>.
    // A player creates their ballot once per round, and may MOVE it (change
    // only the choice field) when re-confirming in a later session. Nobody
    // can edit anyone else's ballot, change its round, or delete anything.
    match /polls/{pollId}/voters/{ballotId} {
      allow read: if true;
      allow create: if request.auth != null
                    && ballotId.split('__')[0] == request.auth.uid
                    && request.resource.data.keys().hasOnly(['choice', 'round', 'at'])
                    && request.resource.data.choice is int
                    && request.resource.data.choice >= 0
                    && request.resource.data.choice < 32
                    && request.resource.data.round is string;
      allow update: if request.auth != null
                    && ballotId.split('__')[0] == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['choice'])
                    && request.resource.data.choice is int
                    && request.resource.data.choice >= 0
                    && request.resource.data.choice < 32
                    && resource.data.round == request.resource.data.round;
      allow delete: if false;
    }"""
if old_rules in rules:
    rules = rules.replace(old_rules, new_rules, 1)
    open(RP, 'w', encoding='utf-8').write(rules)
    print('  fixed: firestore.rules (moveable ballots)')
else:
    print('  rules already updated or anchor missing')
