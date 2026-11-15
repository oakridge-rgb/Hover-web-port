# 🖖 Hover! (1995) — the original game, recompiled to WebAssembly

A port of **Hover!** (Microsoft, 1995 — the capture-the-flag hovercraft game
from the Windows 95 CD) that runs the **actual original binary's code**: the
HOVER.EXE machine code is statically recompiled to C by
[pcrecomp](https://github.com/sp00nznet/hover) (5,411 functions, 0 errors,
480K lines) and built with Emscripten to a WebAssembly runtime. The Win32
environment (messages, GDI, mmio, waveOut, MIDI, registry) is provided by
pcrecomp's portable `win32hle` layer plus ~57 Hover-specific shims, backed by
canvas, WebAudio and localStorage.

**Status: in development** — see [FAITHFULNESS.md](FAITHFULNESS.md) for the
precise honest list of what works and what is still being brought up.

## Files

```
hover.js / hover.wasm   the recompiled game + Win32 HLE (one build)
hover.data              the original game data (MAZES, SOUNDS, DASHRES.DLL…)
src/                    the complete build (build.sh, web host, driver)
FAITHFULNESS.md         what is authentic / reconstructed / unfinished
```

## Building

```
cd src
# needs: the pcrecomp checkout with runtime/win32hle patched per
# scripts/hover_hle_patch.py, the pcrecomp lift of HOVER.EXE (run_lift.py),
# emsdk, then: bash build.sh
```

Hover! is © 1995 Microsoft Corporation. The data ships with attribution, as
the ReactOS and PortMaster distributions do; nothing of Microsoft's code is
modified — the lifted C is generated from the binary.
