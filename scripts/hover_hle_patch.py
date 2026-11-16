#!/usr/bin/env python3
"""Vendored win32hle patches for Hover! + first-frame instrumentation.

Run on a PRISTINE pcrecomp checkout. Not idempotent (asserts fail if re-run).

- gdidc.c: 8bpp-window nearest-palette blit; window-palette capture;
  ExtTextOutA/TabbedTextOutA; blt/GetDC trace counters
- gdi32.c: 256-colour screen-DC answer; missing simple functions
- user32.c: properties, SystemParametersInfoA, small missing functions;
  ShowWindow/InvalidateRect/SetTimer traces
"""
W = "/home/z/my-project/pcrecomp/runtime/win32hle/"

# ================= gdidc.c =================
s = open(W + "gdidc.c").read()

pre = """int hle_dbg_blts, hle_dbg_win_blts, hle_dbg_getdc, hle_dbg_beginpaint;
static uint32_t hle_gdi_win_pal[256];
static int      hle_gdi_win_pal_n;
int hle_gdi_window_palette(uint32_t *out) {
    memcpy(out, hle_gdi_win_pal, 256 * 4);
    return hle_gdi_win_pal_n;
}
static void hle_record_win_pal(dc_t *dst);   /* defined after GOBJ */
"""
anchor_fn = "uint32_t hle_gdi_window_dc(void) {"
assert anchor_fn in s, "window dc fn"
s = s.replace(anchor_fn, pre + "\n" + anchor_fn, 1)

old_ret = """    if (x && g_win_px) x->px = g_win_px, x->w = g_win_w, x->h = g_win_h, x->pitch = g_win_pitch, x->bpp = g_win_bpp, x->win = 1;
    return d;
}"""
assert old_ret in s, "window dc body"
s = s.replace(old_ret, """    if (x && g_win_px) x->px = g_win_px, x->w = g_win_w, x->h = g_win_h, x->pitch = g_win_pitch, x->bpp = g_win_bpp, x->win = 1;
    hle_dbg_getdc++;
    if (hle_dbg_getdc <= 25)
        fprintf(stderr, "[trace] window DC %u: px=%s w=%d bpp=%d\\n", d, x->px ? "bound" : "NULL", x->w, x->bpp);
    return d;
}""", 1)

import re
m = re.search(r"^static uint32_t new_obj\(int type\) \{.*?^\}$", s, re.M | re.S)
assert m, "new_obj"
recorder = """
static void hle_record_win_pal(dc_t *dst) {
    gobj_t *po = dst->pal ? GOBJ(dst->pal) : NULL;
    if (po && po->pal) {
        int n = po->paln > 256 ? 256 : po->paln;
        memcpy(hle_gdi_win_pal, po->pal, (size_t)n * 4);
        hle_gdi_win_pal_n = n;
    }
}
"""
s = s[:m.end()] + recorder + s[m.end():]

old_blt = """static void blt(dc_t *dst, int dx, int dy, int w, int h, dc_t *src, int sx, int sy, int sw, int sh) {
    if (!dst || !dst->px || !src || !src->px || w <= 0 || h <= 0) return;
    int same = src->bpp == dst->bpp && src->is555 == dst->is555 && src->bpp != 8;
    if (dst->win) g_win_seq++;"""
assert old_blt in s, "blt"
s = s.replace(old_blt, """static void blt(dc_t *dst, int dx, int dy, int w, int h, dc_t *src, int sx, int sy, int sw, int sh) {
    hle_dbg_blts++;
    if (hle_dbg_blts <= 30)
        fprintf(stderr, "[trace] blt#%d: dst=%p win=%d bpp=%d px=%p src=%p bpp=%d px=%p rect %d,%d %dx%d\\n",
                hle_dbg_blts, (void *)dst, dst ? dst->win : -1, dst ? dst->bpp : -1,
                dst ? (void *)dst->px : NULL, (void *)src, src ? src->bpp : -1, src ? (void *)src->px : NULL,
                dx, dy, w, h);
    if (!dst || !dst->px || !src || !src->px || w <= 0 || h <= 0) return;
    int same = src->bpp == dst->bpp && src->is555 == dst->is555 && src->bpp != 8;
    if (dst->win) { g_win_seq++; hle_dbg_win_blts++; hle_record_win_pal(dst); }""", 1)

old_grey = "    if (d->bpp == 8) return (r * 77 + g * 151 + b * 28) >> 8;      /* ponytail: grey; nothing blits into an 8bpp DIB yet */"
assert old_grey in s, "grey"
s = s.replace(old_grey, """    if (d->bpp == 8) {                                              /* 8bpp window: nearest palette entry */
        gobj_t *po = d->pal ? GOBJ(d->pal) : NULL;
        if (po && po->pal && po->paln > 0) {
            int best = 0, bestd = 0x7FFFFFFF;
            for (int i = 0; i < po->paln; i++) {
                uint32_t p = po->pal[i];
                int dr = r - (int)(p & 0xFF), dg = g - (int)((p >> 8) & 0xFF), db = b - (int)((p >> 16) & 0xFF);
                int dist = dr * dr + dg * dg + db * db;
                if (dist < bestd) { bestd = dist; best = i; if (!dist) break; }
            }
            return best;
        }
        return (r * 77 + g * 151 + b * 28) >> 8;
    }""", 1)

tbl_decl = "const win32hle_shim win32hle_gdidc[] = {"
assert tbl_decl in s, "gdidc table"
funcs = """/* ExtTextOutA/TabbedTextOutA run the TextOutA body with the registers parked
 * (the shim ABI keeps its args on g_esp). */
static void g_TextOutA(void);
static void g2_text_call(uint32_t h, uint32_t x, uint32_t y, uint32_t str, uint32_t n) {
    uint32_t a[5] = { h, x, y, str, n };
    uint32_t save0 = g_eax, save1 = g_ecx, save2 = g_edx, save3 = g_ebx,
             save4 = g_esp, save5 = g_ebp, save6 = g_esi, save7 = g_edi;
    g_eax = 0; g_ecx = 0; g_edx = 0; g_ebx = 0; g_esp = (uintptr_t)a - 4; g_ebp = 0; g_esi = 0; g_edi = 0;
    g_TextOutA();
    g_eax = save0; g_ecx = save1; g_edx = save2; g_ebx = save3;
    g_esp = save4; g_ebp = save5; g_esi = save6; g_edi = save7;
}
static void g_ExtTextOutA(void) {
    uint32_t opts = A32(3), rect = A32(4);
    dc_t *d = DC(A32(0));
    if (d && d->px && (opts & 2u) && rect) {
        int l = (int)(int16_t)MEM16(rect), t = (int)(int16_t)MEM16(rect + 2);
        int r = (int)(int16_t)MEM16(rect + 4), b = (int)(int16_t)MEM16(rect + 6);
        for (int j = t; j < b; j++)
            for (int i = l; i < r; i++) put(d, i, j, (uint32_t)d->bk);
    }
    if (A32(6) && A32(5)) g2_text_call(A32(0), A32(1), A32(2), A32(5), A32(6));
    RET(1, 8);
}
static void g_TabbedTextOutA(void) {
    if (A32(4) && A32(3)) g2_text_call(A32(0), A32(1), A32(2), A32(3), A32(4));
    RET(0, 8);
}

"""
s = s.replace(tbl_decl, funcs + tbl_decl, 1)
old_te = '    { "GetTextMetricsA", g_GetTextMetricsA }, { "TextOutA", g_TextOutA },'
assert old_te in s, "textout entry"
s = s.replace(old_te, old_te + '\n    { "ExtTextOutA", g_ExtTextOutA }, { "TabbedTextOutA", g_TabbedTextOutA },', 1)
open(W + "gdidc.c", "w").write(s)
print("gdidc ok")

# ================= gdi32.c =================
t = open(W + "gdi32.c").read()
old = """const win32hle_shim win32hle_gdi32[] = {
    { "GetDeviceCaps",      g_GetDeviceCaps },
    { "CreateDIBSection",   g_CreateDIBSection },
    { "StretchDIBits",      g_StretchDIBits },
    /* CreateCompatibleDC/DeleteDC now in gdidc.c (real DCs for BitBlt) */
    { 0, 0 }
};"""
assert old in t, "gdi32 table"
new = """static int g2_screen_palette_mode(void);
static int g2_screen_palette_count = 4;
static int g2_screen_palette_mode(void) { return g2_screen_palette_count-- > 0; }

static void g2_GdiFlush(void) { RET(1, 0); }
static void g2_GdiSetBatchLimit(void) { RET(0x14u, 1); }
static void g2_SetMapMode(void) { RET(1, 2); }
static void g2_GetClipBox(void) {
    if (A32(1)) { MEM32(A32(1)) = 0; MEM32(A32(1)+4) = 0; MEM32(A32(1)+8) = 0x7FFF; MEM32(A32(1)+12) = 0x7FFF; }
    RET(2, 2);
}
static void g2_PtVisible(void) { RET(1, 4); }
static void g2_RectVisible(void) { RET(1, 2); }
static void g2_Escape(void) { RET(0, 7); }
static void g2_CombineRgn(void) { RET(1, 4); }
static void g2_SetRectRgn(void) { RET(1, 7); }
static void g2_CreatePatternBrush(void) { RET(0, 1); }
static void g2_OffsetViewportOrgEx(void) { RET(1, 4); }
static void g2_SetViewportExtEx(void) { RET(1, 4); }
static void g2_SetWindowExtEx(void) { RET(1, 4); }
static void g2_ScaleViewportExtEx(void) { RET(1, 6); }
static void g2_ScaleWindowExtEx(void) { RET(1, 6); }

const win32hle_shim win32hle_gdi32[] = {
    { "GetDeviceCaps",      g_GetDeviceCaps },
    { "CreateDIBSection",   g_CreateDIBSection },
    { "StretchDIBits",      g_StretchDIBits },
    { "GdiFlush",           g2_GdiFlush },
    { "GdiSetBatchLimit",   g2_GdiSetBatchLimit },
    { "SetMapMode",         g2_SetMapMode },
    { "GetClipBox",         g2_GetClipBox },
    { "PtVisible",          g2_PtVisible },
    { "RectVisible",        g2_RectVisible },
    { "Escape",             g2_Escape },
    { "CombineRgn",         g2_CombineRgn },
    { "SetRectRgn",         g2_SetRectRgn },
    { "CreatePatternBrush", g2_CreatePatternBrush },
    { "OffsetViewportOrgEx", g2_OffsetViewportOrgEx },
    { "SetViewportExtEx",   g2_SetViewportExtEx },
    { "SetWindowExtEx",     g2_SetWindowExtEx },
    { "ScaleViewportExtEx", g2_ScaleViewportExtEx },
    { "ScaleWindowExtEx",   g2_ScaleWindowExtEx },
    /* CreateCompatibleDC/DeleteDC now in gdidc.c (real DCs for BitBlt) */
    { 0, 0 }
};"""
t = t.replace(old, new)
old_caps = """        case 104: v = 0; break;                           /* SIZEPALETTE: not a palette device */
        case 38: v = 0;  break;                           /* RASTERCAPS: no RC_PALETTE */
        default: v = 0;  break;
    }
    RET(v, 2);"""
assert old_caps in t, "caps"
t = t.replace(old_caps, """        case 104: v = 0; break;                           /* SIZEPALETTE: not a palette device */
        case 38: v = 0;  break;                           /* RASTERCAPS: no RC_PALETTE */
        default: v = 0;  break;
    }
    if (A32(1) == 38 || A32(1) == 104) {                /* palette device: Hover! is an 8-bit game */
        switch (A32(1)) {
            case 38:  v = 0x100u; break;                /* RC_PALETTE (the game tests ah&1) */
            case 104: v = 256; break;                   /* SIZEPALETTE */
        }
    }
    RET(v, 2);""", 1)
open(W + "gdi32.c", "w").write(t)
print("gdi32 ok")

# ================= user32.c =================
u = open(W + "user32.c").read()
ui = u.index("const win32hle_shim win32hle_user32[] = {")
defs = """/* ---- Hover! additions ---- */
static struct { uint32_t hwnd, prop, data; } g_props[256];
static int g_nprops = 0;
static void u_SetPropA(void) {
    for (int i = 0; i < g_nprops; i++)
        if (g_props[i].hwnd == A32(0) && g_props[i].prop == A32(1)) { g_props[i].data = A32(2); RET(1, 3); }
    if (g_nprops < 256) {
        g_props[g_nprops].hwnd = A32(0), g_props[g_nprops].prop = A32(1), g_props[g_nprops].data = A32(2);
        g_nprops++;
    }
    RET(1, 3);
}
static void u_GetPropA(void) {
    for (int i = 0; i < g_nprops; i++)
        if (g_props[i].hwnd == A32(0) && g_props[i].prop == A32(1)) RET(g_props[i].data, 1);
    RET(0, 1);
}
static void u_RemovePropA(void) {
    for (int i = 0; i < g_nprops; i++)
        if (g_props[i].hwnd == A32(0) && g_props[i].prop == A32(1)) {
            uint32_t d = g_props[i].data;
            g_props[i] = g_props[--g_nprops];
            RET(d, 1);
        }
    RET(0, 1);
}
static void u_SystemParametersInfoA(void) {
    uint32_t action = A32(0), out = A32(2);
    if (action == 48 && out) {
        MEM32(out) = 0; MEM32(out+4) = 0; MEM32(out+8) = 800; MEM32(out+12) = 600;
    }
    RET(1, 4);
}
static void u_IsChild(void) { RET(0, 2); }
static void u_IsIconic(void) { RET(0, 1); }
static void u_IsZoomed(void) { RET(0, 1); }
static void u_GetWindowDC(void) { RET(hle_gdi_window_dc(), 1); }
static void u_GetDCEx(void) { RET(hle_gdi_window_dc(), 3); }
static void u_InvertRect(void) { RET(1, 2); }
static void u_GrayStringA(void) { RET(1, 9); }
static void u_GetMessageTime(void) { RET(hle_ticks_ms(), 0); }
static void u_GetMessagePos(void) { RET(0x012C0190u, 0); }
static void u_GetMenuCheckMarkDimensions(void) { RET((16u << 16) | 16u, 0); }
static void u_GetLastActivePopup(void) { RET(A32(0), 1); }
static void u_ShowOwnedPopups(void) { RET(1, 2); }
static void u_CheckRadioButton(void) { RET(1, 4); }
static void u_SetMenuItemBitmaps(void) { RET(1, 4); }
static void u_SetParent(void) { RET(0, 2); }
static void u_UnpackDDElParam(void) { RET(A32(2), 4); }
static void u_ReuseDDElParam(void) { RET(A32(0), 5); }
static void u_OemToCharA(void) {
    if (A32(0) && A32(1)) {
        const uint8_t *s = (const uint8_t *)hle_ptr(A32(0));
        uint8_t *d = (uint8_t *)hle_ptr(A32(1));
        for (int i = 0; i < 256; i++) { d[i] = s[i]; if (!s[i]) break; }
    }
    RET(1, 2);
}
static void u_CharToOemA(void) {
    if (A32(0) && A32(1)) {
        const uint8_t *s = (const uint8_t *)hle_ptr(A32(0));
        uint8_t *d = (uint8_t *)hle_ptr(A32(1));
        for (int i = 0; i < 256; i++) { d[i] = s[i]; if (!s[i]) break; }
    }
    RET(1, 2);
}
static void u_VkKeyScanA(void) {
    uint8_t c = (uint8_t)A32(0);
    uint32_t vk = (c >= 'a' && c <= 'z') ? c - 32 : c;
    RET((vk << 16) | vk, 1);
}

"""
u = u[:ui] + defs + u[ui:]
ui = u.index("const win32hle_shim win32hle_user32[] = {")
uend = u.index("{ 0, 0 }", ui)
entries = """{ "SetPropA", u_SetPropA }, { "GetPropA", u_GetPropA }, { "RemovePropA", u_RemovePropA },
    { "SystemParametersInfoA", u_SystemParametersInfoA },
    { "IsChild", u_IsChild }, { "IsIconic", u_IsIconic }, { "IsZoomed", u_IsZoomed },
    { "GetWindowDC", u_GetWindowDC }, { "GetDCEx", u_GetDCEx },
    { "InvertRect", u_InvertRect }, { "GrayStringA", u_GrayStringA },
    { "GetMessageTime", u_GetMessageTime }, { "GetMessagePos", u_GetMessagePos },
    { "GetMenuCheckMarkDimensions", u_GetMenuCheckMarkDimensions },
    { "GetLastActivePopup", u_GetLastActivePopup }, { "ShowOwnedPopups", u_ShowOwnedPopups },
    { "CheckRadioButton", u_CheckRadioButton }, { "SetMenuItemBitmaps", u_SetMenuItemBitmaps },
    { "SetParent", u_SetParent }, { "UnpackDDElParam", u_UnpackDDElParam },
    { "ReuseDDElParam", u_ReuseDDElParam }, { "OemToCharA", u_OemToCharA },
    { "CharToOemA", u_CharToOemA }, { "VkKeyScanA", u_VkKeyScanA },
    """
u = u[:uend] + entries + u[uend:]

for tag, trace in (
    ("static void u_ShowWindow(void) {", '    extern int hle_dbg_blts;\n    fprintf(stderr, "[trace] ShowWindow(hwnd=%u cmd=%d) blts=%d\\n", A32(0), (int)A32(1), hle_dbg_blts);\n'),
    ("static void u_InvalidateRect(void) {", '    extern int hle_dbg_blts;\n    static int n_ir;\n    if (++n_ir <= 20) fprintf(stderr, "[trace] InvalidateRect(hwnd=%u) blts=%d\\n", A32(0), hle_dbg_blts);\n'),
    ("static void u_SetTimer(void) {", '    fprintf(stderr, "[trace] SetTimer(hwnd=%u id=%u elapse=%u proc=%u)\\n", A32(0), A32(1), A32(2), A32(3));\n'),
):
    i = u.find(tag)
    if i < 0:
        print("note: no shim for", tag.split("(")[0]); continue
    r = u.index("RET(", i)
    insert = u.rindex("\n", i, r) + 1
    u = u[:insert] + trace + u[insert:]
open(W + "user32.c", "w").write(u)
print("user32 ok")
