/* web_hooks.c - the runtime hooks the lifted code calls (the sp00nznet
 * multiplayer patch points), reduced to exact single-player semantics:
 * one seat, one view, the original behaviour. Signatures from the lift's
 * recomp_funcs.h; semantics from mp.c's g_seats < 2 branches. */
#include "win32hle.h"

void sub_00402250(void);   /* the original single-view render pass */
void sub_00405B90(void);   /* the original sprite-visible body */

#define G_DOC      0x00460970u
#define DOC_HUMAN  0x818Cu

uint32_t hover_cam_obj(uint32_t doc) { return doc + DOC_HUMAN; }
void hover_render_views(void) { sub_00402250(); }
int mp_is_seat(uint32_t craft) { (void)craft; return 0; }
uint32_t hover_pod_hud(uint32_t view, uint32_t owner) { (void)owner; return view; }
uint32_t hover_hud_full(void) { return MEM32(0x004C4CA8u); }
uint32_t hover_team_flags(uint32_t craft) { return MEM32(craft + 0xC0); }
uint32_t hover_quarry(uint32_t doc, uint32_t state) { (void)state; return doc + DOC_HUMAN; }
void hover_sprite_visible(void) { sub_00405B90(); }
void hover_seen_mark(uint32_t obj) { (void)obj; }
uint32_t hover_seen_byte(uint32_t obj) { return MEM8(obj + 0x24); }
void hover_seen_forget(uint32_t obj) { (void)obj; }
uint32_t hover_heard(uint32_t craft) { return MEM32(craft + 0x1F8); }
