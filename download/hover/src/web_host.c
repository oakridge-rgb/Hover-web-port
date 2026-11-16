/* web_host.c - the browser host for the lifted HOVER.EXE (Hover! 1995).
 *
 * Runs the whole original game, statically recompiled to C by pcrecomp
 * (sp00nznet/hover), inside WebAssembly: guest memory is the wasm linear
 * memory (flat model), the game's window DC draws into an 8-bit surface the
 * JS side blits to a canvas, sound goes to WebAudio, MIDI to a JS synth,
 * input comes from browser events, and the registry persists in localStorage.
 */
#define _GNU_SOURCE
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>
#include "win32hle.h"
#include "pe_loader.h"

static pe_image g_img;
static int      g_booted;

uint32_t web_now_ms(void) { return (uint32_t)emscripten_get_now(); }
void web_timers_service(void);
const win32hle_shim *win32hle_web_winmm_shims(void);
const win32hle_shim *win32hle_web_mmio_shims(void);
int hw_dashres(void);
const win32hle_shim *win32hle_web_misc_shims(void);
int hle_gdi_window_palette(uint32_t *out);
void hle_ws_poll(void);

/* ------------------------------------------------ command line / modules */
static char g_cmdline[256] = "HOVER.EXE ";

static void k_GetCommandLineA(void) { RET((uint32_t)(uintptr_t)g_cmdline, 0); }
static void k_GetModuleHandleA(void) {
    uint32_t n = A32(0);
    RET((!n || !strcmp((const char *)hle_ptr(n), "HOVER.EXE")) ? 0x00400000u : 0, 1);
}
static void k_GetModuleFileNameA(void) {
    uint32_t h = A32(0), size = A32(2), out = A32(1);
    if (!h || h == 0x00400000u) {
        uint32_t n = (uint32_t)strlen("C:\\HOVER\\HOVER.EXE");
        if (size) { if (n >= size) n = size - 1;
            memcpy((void *)hle_ptr(out), "C:\\HOVER\\HOVER.EXE", n);
            MEM8(out + n) = 0; }
        RET(n, 3);
    }
    RET(0, 3);   /* other modules: the stock module.c answers via module table */
}

/* ------------------------------------------------ the window surface */
#define SURF_W 800
#define SURF_H 600
static uint32_t g_surf;
static volatile int g_presented;

static void present_hook(void) { g_presented = 1; }

/* ------------------------------------------------ pump */
static uint32_t g_last_yield, g_last_paint;
static uint32_t g_last_beat;
static void pump(void) {
    /* web_timers_service(); -- moved to hw_frame only: firing guest code
     * re-entrantly from inside a shim (the pump runs mid-shim) corrupts the
     * suspended guest state under asyncify. */
    {   /* heartbeat: where is the guest? */
        extern int hle_dbg_blts, hle_dbg_win_blts, hle_dbg_getdc, hle_dbg_beginpaint;
        extern int hle_dbg_msgs;
        uint32_t now = web_now_ms();
        if (now - g_last_beat >= 2000) {
            g_last_beat = now;
            static int beats;
            if (beats++ < 25)
                fprintf(stderr, "[beat] blts=%d win=%d getdc=%d msgs=%d presented=%d\n",
                        hle_dbg_blts, hle_dbg_win_blts, hle_dbg_getdc, hle_dbg_msgs, g_presented);
        }
    }
    uint32_t now = web_now_ms();
    if (now - g_last_paint >= 50) {          /* keep the guest's window painting */
        uint32_t h = hle_first_hwnd();
        if (h) hle_post_message(h, 0x000Fu, 0, 0);   /* WM_PAINT */
        g_last_paint = now;
    }
    if (now - g_last_yield >= 12) {          /* the original busy-loops: slice for the browser */
        g_last_yield = now + 400;            /* first slices are cheap; then ~1/40 s */
        emscripten_sleep(1);
    }
}

/* ------------------------------------------------ boot */
static const char *const g_subsystems_ok[] = {
    "kernel32", "gdi32", "user32", "winmm", "advapi32", NULL
};

EMSCRIPTEN_KEEPALIVE
int hw_boot(void) {
    /* my winmm first: hle_resolve is first-match-wins */
    win32hle_register(win32hle_web_winmm_shims());
    win32hle_register(win32hle_web_mmio_shims());
    win32hle_register(win32hle_web_misc_shims());
    win32hle_register(win32hle_kernel32);
    win32hle_register(win32hle_kernel32_ext);
    win32hle_register(win32hle_kernel32_crt);
    win32hle_register(win32hle_module);
    win32hle_register(win32hle_gdidc);
    win32hle_register(win32hle_gdi32);
    win32hle_register(win32hle_user32);
    win32hle_register(win32hle_lz32);
    win32hle_register(win32hle_ole32);
    win32hle_register(win32hle_storage);
    win32hle_register(win32hle_advapi32);

    hle_set_drive('C', "/c");

    /* registry: what an installed copy would have (plus the .reg persistence
     * file, synced to localStorage by JS) */
    hle_reg_set_dword(1, "Software\\Microsoft\\Hover!", "StartAtLevel", 1);
    hle_reg_load("/c/HOVER/hover.reg");

    if (recomp_pe_map("/c/HOVER/HOVER.EXE", &g_img) != 0) {
        fprintf(stderr, "[web] PE map failed\n"); return 1;
    }
    hle_module_add("C:\\HOVER\\HOVER.EXE", g_img.base, g_img.resource_rva, g_img.resource_size, 1);
    /* DASHRES.DLL is resources only: register it so FindResource/LoadBitmap work */
    hle_module_add("C:\\HOVER\\DASHRES.DLL", 0, 0, 0, 0);

    int unresolved = recomp_pe_bind(&g_img, hle_resolve);
    fprintf(stderr, "[web] booted: entry 0x%08X, unresolved %d\n", g_img.entry, unresolved);

    hw_dashres();                          /* DASHRES.DLL: resources only, before the surface */
    void *p = hle_heap_alloc((uint32_t)SURF_W * SURF_H, 1);
    if (p) {
        g_surf = hle_va(p);
        hle_gdi_window_surface((uint8_t *)p, SURF_W, SURF_H, SURF_W, 8);
    }
    hle_gdi_window_hook = present_hook;
    hle_set_pump_hook(pump);

    g_booted = 1;
    return unresolved ? 2 : 0;
}

/* LoadLibraryA("DASHRES.DLL") must map the DLL as resources-only: the stock
 * module.c LoadLibraryA answers for system DLLs; DASHRES is a guest file, so
 * map it as a module whose resources the resource loader can find. */
EMSCRIPTEN_KEEPALIVE
int hw_dashres(void) {
    pe_image d;
    if (recomp_pe_map("/c/HOVER/DASHRES.DLL", &d) != 0) return 1;
    hle_module_add("C:\\HOVER\\DASHRES.DLL", d.base, d.resource_rva, d.resource_size, 0);
    fprintf(stderr, "[web] DASHRES mapped at 0x%08X\n", d.base);
    return 0;
}

EMSCRIPTEN_KEEPALIVE
void hw_run(void) {
    if (!g_booted) return;
    uint32_t args[0];
    hle_call_guest(g_img.entry, 0, args);
}

/* ------------------------------------------------ input */
EMSCRIPTEN_KEEPALIVE
void hw_key(int down, uint32_t vk, uint32_t scan) { hle_input_key(down, vk, scan); }
EMSCRIPTEN_KEEPALIVE
void hw_char(uint32_t ch) {
    uint32_t h = hle_focus_window();
    if (h) hle_post_message(h, 0x0102u /* WM_CHAR */, ch, 0);
}
EMSCRIPTEN_KEEPALIVE
void hw_mouse(uint32_t msg, int x, int y) { hle_input_mouse(msg, x, y); }

/* ------------------------------------------------ screen out */
EMSCRIPTEN_KEEPALIVE
uint32_t hw_screen_ptr(void) { return g_surf; }
EMSCRIPTEN_KEEPALIVE
int hw_screen_dims(int *out) { out[0] = SURF_W; out[1] = SURF_H; return 0; }
EMSCRIPTEN_KEEPALIVE
int hw_presented(void) { int p = g_presented; g_presented = 0; return p; }

/* copy the palette the window's blits resolved through */
EMSCRIPTEN_KEEPALIVE
void hw_palette(uint32_t out) {
    extern int hle_gdi_window_palette(uint32_t * out);   /* patched into gdidc.c */
    uint32_t tmp[256];
    hle_gdi_window_palette(tmp);
    uint32_t *d = (uint32_t *)hle_ptr(out);
    for (int i = 0; i < 256; i++)
        d[i] = 0xFF000000u | (tmp[i] & 0xFF) | ((tmp[i] & 0xFF00u)) | ((tmp[i] & 0xFF0000u));
    /* entries are 0x00RRGGBB (little endian bytes B,G,R) -> ABGR for JS/Uint32 */
}

/* ------------------------------------------------ registry persistence */
/* the HLE registry saves itself on change; JS syncs the file out */
EMSCRIPTEN_KEEPALIVE
void hle_ws_poll(void) { }

/* --- misc one-or-two-call DLLs: SHELL32, COMDLG32, WINSPOOL, advapi extras --- */
static void x_ShellAboutA(void) { RET(1, 3); }
static void x_DragFinish(void) { RET(0, 1); }
static void x_DragQueryFileA(void) { RET(0, 4); }
static void x_GetOpenFileNameA(void) { RET(0, 1); }   /* cancel */
static void x_GetSaveFileNameA(void) { RET(0, 1); }
static void x_GetFileTitleA(void) {
    uint32_t name = A32(0), out = A32(1), len = A32(2);
    if (out && len) { const char *p = (const char *)hle_ptr(name); const char *b = strrchr(p, '\\'); b = b ? b + 1 : p;
        snprintf((char *)hle_ptr(out), len, "%s", b); }
    RET(0, 3);
}
static void x_OpenPrinterA(void) { RET(1, 5); }
static void x_ClosePrinter(void) { RET(1, 1); }
static void x_DocumentPropertiesA(void) { RET(-1u, 7); }
static void x_TerminateThread(void) { RET(1, 2); }
static void x_RegQueryValueA(void) { RET(2u /*ERROR_FILE_NOT_FOUND*/, 4); }
static void x_SetThreadAffinityMask(void) { RET(1, 2); }
static void x_ChangeDisplaySettingsA(void) { RET(0, 4); }
static void x_SetScrollInfo(void) { RET(1, 3); }
static void x_GetScrollInfo(void) { RET(1, 3); }

const win32hle_shim *win32hle_web_misc_shims(void);
static const win32hle_shim g_misc[] = {
    { "ShellAboutA", x_ShellAboutA }, { "DragFinish", x_DragFinish },
    { "DragQueryFileA", x_DragQueryFileA },
    { "GetOpenFileNameA", x_GetOpenFileNameA }, { "GetSaveFileNameA", x_GetSaveFileNameA },
    { "GetFileTitleA", x_GetFileTitleA },
    { "OpenPrinterA", x_OpenPrinterA }, { "ClosePrinter", x_ClosePrinter },
    { "DocumentPropertiesA", x_DocumentPropertiesA },
    { "TerminateThread", x_TerminateThread },
    { "RegQueryValueA", x_RegQueryValueA },
    { "SetThreadAffinityMask", x_SetThreadAffinityMask },
    { "ChangeDisplaySettingsA", x_ChangeDisplaySettingsA },
    { "SetScrollInfo", x_SetScrollInfo }, { "GetScrollInfo", x_GetScrollInfo },
    { NULL, NULL }
};
const win32hle_shim *win32hle_web_misc_shims(void) { return g_misc; }

/* ------------------------------------------------ timers + frame work */
EMSCRIPTEN_KEEPALIVE
void hw_frame(void) {
    web_timers_service();
}

/* exit code of the guest process */
EMSCRIPTEN_KEEPALIVE
int hw_alive(void) { return g_booted; }
