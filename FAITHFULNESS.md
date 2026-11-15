# FAITHFULNESS REPORT — Hover! (1995) web port

What is verified authentic, what is reconstructed, and what is unfinished.
This port takes the strongest possible form of "faithful": it runs the
**actual original game code**.

## The approach

HOVER.EXE was statically recompiled to C with the `pcrecomp` toolchain
(sp00nznet/hover — 5,411 functions lifted, 0 errors, 480,241 lines of C, the
whole program including its statically-linked MFC), and the resulting C is
compiled with Emscripten to WebAssembly. The original logic — physics,
robot AI, flag capture, pods, pads, radar, rendering, menus — is the
original binary's own machine code transcribed, not a re-implementation.

The Win32 environment the game expects is provided by `win32hle`
(pcrecomp's portable Win32 high-level emulation, itself written to run
lifted Windows programs off Windows), extended here for the browser:

- the game's window DC draws into a 32-bit surface that JS blits to a canvas;
- waveOut buffers go to WebAudio, `sndPlaySoundA` likewise;
- `mmioOpenA/Read/Descend/Ascend/Close` are implemented file-backed so the
  game loads its WAVs and MUSICn.muz;
- `midiStream*` (fetched via GetProcAddress) streams the .MUZ MIDI events to
  a small WebAudio synthesizer;
- the registry persists via localStorage (seeded with `StartAtLevel=1`);
- input is browser keyboard/mouse/touch injected as Win32 messages.

## Verified authentic

| Piece | Status |
|---|---|
| Game code | The original HOVER.EXE, lifted function-for-function (SHA of the lift input matches the ReactOS `Hover.exe` package: `2e922090…b730921`) |
| Game data | The original MAZES (4), TEXTURES (4, byte-exact per sp00nznet's parsers), 36 WAVs, 3 MUZ, DASHRES.DLL, HOVER.HLP, README |
| Level system | Verified from the binary: 21-entry table at 0x4C4000 — levels 1-20 cycle MAZE1/2/3, robots 1/1 → 6/4, flags 3 → 6, 7 pod types × 4 each; demo level from SMALL.MAZ |
| Placement | Player/robot/pod/flag starts from `HUMAN_/ROBOT_/POD_RANDOM_/FLAG_HUMAN_/FLAG_ROBOT_` named locations, min-distance re-roll, BEACON_nn AI waypoints — all in the lifted code and the shipped .MAZ files |
| Randomness | MSVC CRT `rand()` (s = s*214013+2531011, (s>>16)&0x7FFF), seeded from the clock once per level load, as in the original |

## Status: what works, what does not (honest)

Working at the time of writing:

- The WASM runtime builds and boots; the original code runs (WinMain, MFC
  init, window creation, the level loader's sound/mmio access, AI and timer
  infrastructure are all reachable — the log shows the game enumerating
  devices and opening its wave files).
- All 349 imports resolve; the HLE shims (including ~57 Hover-specific ones
  added here: mmio file I/O, ExtTextOutA/TabbedTextOutA, property lists,
  SystemParametersInfoA, the 256-colour display check, and the sp00nznet
  multiplayer hooks reduced to single-player semantics).

Not yet working (why, and where the fix goes):

1. **Nothing reaches the canvas yet.** The guest runs but no blit has hit
   the window-DC hook (`hw_presented()` stays 0). Most likely the game is
   still in a modal early dialog (the 256-colour check message box) or its
   first paint is waiting on a message the pump is not delivering. Next
   step: log the guest's window messages for 2 seconds (the HLE already
   names them), dismiss/auto-answer the dialog in the shim
   (`MessageBoxA` shim returning IDOK is the usual one-liner), and confirm
   the first `blt(dst->win)` fires.
2. **mmio paths**: the game opens `Sounds\Mixed\eng_high.WAV` (mixed case);
   the data ships as `SOUNDS/MIXED`. The driver creates case-aliased copies
   at boot (`aliasTree('/c/HOVER/SOUNDS','/c/HOVER/Sounds')`) — verify it
   runs before `hw_boot` (it must, since the game loads sounds during it)
   and that MEMFS `readdir` sees the preloaded tree.
3. **Music**: the midiStream shim is in place; needs a runtime test.
4. **Timing feel**: the pump slices the original's busy loop into browser
   frames (`emscripten_sleep`); the sim tick rate must be checked against
   the original's ~15 fps software rendering.
5. **Android**: the page is responsive and the manifest is drafted; the
   touch layer (driver.js `#touch` pad) posts arrow/jump/wall/cloak keys and
   needs the game visible first.

Everything is saved so this can continue: `download/hover/` has the built
runtime (hover.js/wasm/data), `download/hover/src/` has the complete build
(build.sh, web_host.c, winmm_web.c, web_hooks.c, driver.js, index.html,
pthread_stub.h), and `/tmp/hover-lift` (regenerate with
`scripts/hover_extract.py` + pcrecomp) holds the 480K-line lift and the
patched win32hle. The pcrecomp/HLE patches are documented in
`scripts/hover_hle_patch.py`.

## Sources

1. HOVER.EXE + data — authentic Microsoft files (SHA1-verified via the
   ReactOS package mirror; same content as the Windows 95 CD `FUNSTUFF\HOVER`).
2. sp00nznet/hover — static recompilation toolchain + `docs/maz-format.md`
   (byte-exact MAZ/TEX formats, level table, RNG model).
3. Link4Electronics/FlyingDodgem — decompilation; class layouts (CWorld
   fields incl. inertia 0.99 / accel 1.2 at +0x8478-0x8490).
4. pcrecomp `runtime/win32hle` — portable Win32 HLE (already emscripten-aware).

Hover! is © 1995 Microsoft Corporation. The port ships the original data
with attribution, as the ReactOS and PortMaster projects do; no Microsoft
code is modified — the lifted C is generated from the binary at build time.
