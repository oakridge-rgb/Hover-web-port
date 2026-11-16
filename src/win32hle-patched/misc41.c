/* The 41 imports session 2 answered and the archived runtime predates:
 * small USER32/GDI32 stubs MFC links statically and calls during
 * initialization and painting. Behavior is the Windows-faithful minimal:
 * stateless returns, a few real paths (window DCs, OEM text copies). */
#include <stdint.h>
#include <string.h>
#include "win32hle.h"

extern uint32_t hle_gdi_window_dc(void);

/* ---- USER32 ---- */
static void u_VkKeyScanA(void)          { RET(A32(0) & 0xFFu, 1); }            /* shift=0, the char's own code */
static void u_UnpackDDElParam(void)     { RET(0, 3); }                          /* DDE is never live here */
static void u_ReuseDDElParam(void)      { RET(0, 5); }
static void u_TabbedTextOutA(void)      { RET(0, 8); }
static void u_SystemParametersInfoA(void){ RET(0, 4); }                        /* query fails; MFC has a path */
static void u_ShowOwnedPopups(void)     { RET(1, 2); }
static void u_SetPropA(void)            { RET(1, 3); }
static void u_GetPropA(void)            { RET(0, 2); }
static void u_RemovePropA(void)         { RET(0, 2); }
static void u_SetParent(void)           { RET(0, 2); }
static void u_SetMenuItemBitmaps(void)  { RET(1, 5); }
static void u_IsZoomed(void)            { RET(0, 1); }
static void u_IsIconic(void)            { RET(0, 1); }
static void u_IsChild(void)             { RET(0, 2); }
static void u_GetLastActivePopup(void)  { RET(A32(0), 1); }
static void u_GetMessageTime(void)      { RET(0, 0); }
static void u_GetMessagePos(void)       { RET(0, 0); }
static void u_GetMenuCheckMarkDimensions(void) { RET(0x000D000Du, 0); }        /* 13x13 like Windows 95 */
static void u_CheckRadioButton(void)    { RET(1, 4); }
static void u_GetWindowDC(void)         { RET(hle_gdi_window_dc(), 1); }
static void u_GetDCEx(void)             { RET(hle_gdi_window_dc(), 3); }
static void u_GrayStringA(void)         { RET(1, 8); }
static void u_InvertRect(void)          { RET(1, 2); }
static void u_CharToOemA(void) {          /* (src, dst): byte copy, OEM==ASCII here */
    const char *s = ASTR(0); char *d = ASTR(1);
    if (s && d) { size_t n = strlen(s) + 1; if (n > 512) n = 512; memcpy(d, s, n); }
    RET(1, 2);
}
static void u_OemToCharA(void)          { u_CharToOemA(); }

/* ---- GDI32 ---- */
static void g_SetMapMode(void)          { RET(0, 2); }                          /* previous mode */
static void g_SetWindowExtEx(void)      { RET(1, 4); }
static void g_SetViewportExtEx(void)    { RET(1, 4); }
static void g_ScaleWindowExtEx(void)    { RET(1, 6); }
static void g_ScaleViewportExtEx(void)  { RET(1, 6); }
static void g_OffsetViewportOrgEx(void) { RET(0, 4); }                          /* previous origin */
static void g_RectVisible(void)         { RET(1, 2); }
static void g_PtVisible(void)           { RET(1, 3); }
static void g_GetClipBox(void) {           /* (hdc, lprc): SIMPLEREGION over the surface */
    uint32_t rc = A32(1);
    if (rc) { MEM32(rc) = 0; MEM32(rc + 4) = 0; MEM32(rc + 8) = 799; MEM32(rc + 12) = 479; }
    RET(2, 2);                                           /* SIMPLEREGION */
}
static void g_CombineRgn(void)          { RET(2, 4); }                          /* SIMPLEREGION */
static void g_SetRectRgn(void)          { RET(1, 5); }
static void g_GdiFlush(void)            { RET(1, 0); }
static void g_GdiSetBatchLimit(void)    { RET(10, 1); }                         /* the default limit */
static void g_ExtTextOutA(void)         { RET(1, 8); }                          /* text is not drawn (no TTF) */
static void g_Escape(void)              { RET(0, 5); }
static void g_CreatePatternBrush(void)  { RET(1, 1); }                          /* a hollow-enough handle */

const win32hle_shim win32hle_misc41[] = {
    { "VkKeyScanA",              u_VkKeyScanA },
    { "UnpackDDElParam",         u_UnpackDDElParam },
    { "ReuseDDElParam",          u_ReuseDDElParam },
    { "TabbedTextOutA",          u_TabbedTextOutA },
    { "SystemParametersInfoA",   u_SystemParametersInfoA },
    { "ShowOwnedPopups",         u_ShowOwnedPopups },
    { "SetPropA",                u_SetPropA },
    { "GetPropA",                u_GetPropA },
    { "RemovePropA",             u_RemovePropA },
    { "SetParent",               u_SetParent },
    { "SetMenuItemBitmaps",      u_SetMenuItemBitmaps },
    { "IsZoomed",                u_IsZoomed },
    { "IsIconic",                u_IsIconic },
    { "IsChild",                 u_IsChild },
    { "GetLastActivePopup",      u_GetLastActivePopup },
    { "GetMessageTime",          u_GetMessageTime },
    { "GetMessagePos",           u_GetMessagePos },
    { "GetMenuCheckMarkDimensions", u_GetMenuCheckMarkDimensions },
    { "CheckRadioButton",        u_CheckRadioButton },
    { "GetWindowDC",             u_GetWindowDC },
    { "GetDCEx",                 u_GetDCEx },
    { "GrayStringA",             u_GrayStringA },
    { "InvertRect",              u_InvertRect },
    { "CharToOemA",              u_CharToOemA },
    { "OemToCharA",              u_OemToCharA },
    { "SetMapMode",              g_SetMapMode },
    { "SetWindowExtEx",          g_SetWindowExtEx },
    { "SetViewportExtEx",        g_SetViewportExtEx },
    { "ScaleWindowExtEx",        g_ScaleWindowExtEx },
    { "ScaleViewportExtEx",      g_ScaleViewportExtEx },
    { "OffsetViewportOrgEx",     g_OffsetViewportOrgEx },
    { "RectVisible",             g_RectVisible },
    { "PtVisible",               g_PtVisible },
    { "GetClipBox",              g_GetClipBox },
    { "CombineRgn",              g_CombineRgn },
    { "SetRectRgn",              g_SetRectRgn },
    { "GdiFlush",                g_GdiFlush },
    { "GdiSetBatchLimit",        g_GdiSetBatchLimit },
    { "ExtTextOutA",             g_ExtTextOutA },
    { "Escape",                  g_Escape },
    { "CreatePatternBrush",      g_CreatePatternBrush },
    { 0, 0 }
};
