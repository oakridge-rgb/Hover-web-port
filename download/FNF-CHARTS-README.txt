FNF PSYCH ENGINE CHARTS — Fresh (hard) & Dad Battle (spam)
=============================================================

FILES
  fresh-hard.json        Fresh rechart       (bpm 120, scroll 1.8)
  dadbattle-hard.json    Dad Battle spam     (bpm 180, scroll 2.3)
  dad-battle-hard.json   identical copy, alternate filename (no space)

INSTALL — Psych Engine (0.6.x and 0.7.x)
  1. Copy a chart into your mod's song data folder:

       mods/<your-mod>/data/songs/<song-folder>/<song-folder>-hard.json

     <song-folder> = the song's name, lowercase, spaces become dashes:
       "Dad Battle"  ->  data/songs/dad-battle/dad-battle-hard.json
       "dadbattle"   ->  data/songs/dadbattle/dadbattle-hard.json
       "Fresh"       ->  data/songs/fresh/fresh-hard.json

  2. If your song's folder is named differently, just rename the file
     to <that-folder-name>-hard.json. The name must match exactly.
  3. Play on HARD difficulty. Restart the game after adding files.

WHAT CHANGED VS YOUR ORIGINALS
  - Section count (Fresh: 42 / Dad Battle: 65), BPM, scroll speed and
    EVERY mustHitSection flag are identical to your SNIFF originals,
    so the charts stay perfectly in sync with your audio.
  - Opponent (dad) notes are untouched.
  - Only the player's notes were rewritten.

DIFFICULTY
  Fresh:        player sections sustain 8 notes/sec (16ths at 120 BPM),
                with 32nd-note bursts peaking at 16 notes/sec.
                (Your Bopeebo chart averages ~3.4 notes/sec player side.)
  Dad Battle:   full spam chart — sustained 16th walls at 12 notes/sec,
                single-lane jackhammers, jumpjacks and rolls.
                Sections 31-39 are the wall: 9 straight sections of
                nonstop 12 nps.

TROUBLESHOOTING
  - Chart not loading? The filename AND folder must match the song's
    name exactly (see rule above), and you must be on the matching
    difficulty (this file = HARD).
  - Psych only auto-loads <song>-easy.json, <song>.json (normal) and
    <song>-hard.json. Any other name is ignored.
  - Turn Ghost Tapping ON (options) for Fresh's 32nd bursts.
