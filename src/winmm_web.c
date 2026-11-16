/* winmm_web.c - winmm overrides for the web host, registered BEFORE the
 * stock winmmhle table so hle_resolve (first match wins) picks these:
 *  - multimedia timers fire from the JS pump (no threads on wasm);
 *  - waveOut buffers are handed to WebAudio through JS instead of retired
 *    silently;
 *  - sndPlaySoundA plays through JS;
 *  - midiOut* reports one device and midiStream* (fetched by the game via
 *    GetProcAddress) streams the .MUZ events to the JS synthesizer. */
#define _GNU_SOURCE
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <emscripten.h>
#include <dirent.h>
#include "win32hle.h"

#define MMSYSERR_NOERROR  0u
#define MMSYSERR_ERROR    1u
#define MMSYSERR_ALLOCATED 4u
#define MIDIERR_UNPREPARED 64u
#define JOYERR_UNPLUGGED  167u
#define TIMERR_NOERROR    96u
#define WHDR_DONE         0x00000001u
#define WHDR_INQUEUE      0x00000010u
#define WHDR_PREPARED     0x00000002u
#define MHDR_DONE         0x00000001u
#define MHDR_INQUEUE      0x00000004u
#define MHDR_PREPARED     0x00000002u
#define CALLBACK_TYPEMASK 0x70000u
#define CALLBACK_FUNCTION 0x30000u
#define WAVE_MAPPER       (-1u)

/* guest tick (performance.now based, injected from JS to keep one clock) */
uint32_t web_now_ms(void);

/* ---------------- multimedia timers: serviced by the pump ---------------- */
#define MAX_MMT 8
static struct { int used; uint32_t period_ms, next; uint32_t cb, inst; } g_mmt[MAX_MMT];

static void m_timeSetEvent(void) {             /* (delay, res, proc, inst, flags) */
    uint32_t delay = A32(0), proc = A32(2), inst = A32(3), flags = A32(4);
    if (proc && !(flags & CALLBACK_TYPEMASK & CALLBACK_FUNCTION)) proc = 0;
    for (int i = 0; i < MAX_MMT; i++) {
        if (!g_mmt[i].used) {
            g_mmt[i].used = 1;
            g_mmt[i].period_ms = delay ? delay : 1;
            g_mmt[i].next = web_now_ms() + g_mmt[i].period_ms;
            g_mmt[i].cb = proc;
            g_mmt[i].inst = inst;
            RET((uint32_t)(i + 1), 5);
            return;
        }
    }
    RET(0, 5);
}

static void m_timeKillEvent(void) {
    uint32_t id = A32(0);
    if (id >= 1 && id <= MAX_MMT) g_mmt[id - 1].used = 0;
    RET(TIMERR_NOERROR, 1);
}

/* called from the pump: run every due timer callback (guest code, through
 * hle_call_guest, exactly as winmm's thread would) */
void web_timers_service(void) {
    uint32_t now = web_now_ms();
    for (int i = 0; i < MAX_MMT; i++) {
        if (!g_mmt[i].used) continue;
        if (now >= g_mmt[i].next) {
            g_mmt[i].next += g_mmt[i].period_ms;
            if (now - g_mmt[i].next > 250) g_mmt[i].next = now + g_mmt[i].period_ms;
            uint32_t a[4] = { (uint32_t)(i + 1), 0, g_mmt[i].inst, 0 };
            hle_call_guest(g_mmt[i].cb, 4, a);
        }
    }
}

/* ---------------- waveOut: buffers go to WebAudio ---------------- */
static int g_wave_open;

static void w_waveOutOpen(void) {              /* (&hwo, dev, &fmt, cb, inst, flags) */
    uint32_t ph = A32(0);
    if (ph) MEM32(ph) = 0x00D0C0DEu;
    g_wave_open = 1;
    emscripten_run_script("window.HoverWave && HoverWave.open()");
    RET(MMSYSERR_NOERROR, 6);
}
static void w_waveOutClose(void) { g_wave_open = 0; RET(MMSYSERR_NOERROR, 1); }
static void w_waveOutReset(void) {
    emscripten_run_script("window.HoverWave && HoverWave.reset()");
    RET(MMSYSERR_NOERROR, 1);
}
static void w_waveOutWrite(void) {             /* (hwo, lpWaveHdr, cbwh) */
    uint32_t wh = A32(1);
    if (wh) {
        uint32_t data = MEM32(wh + 0), len = MEM32(wh + 4);
        if (data && len) {
            EM_ASM_({ if (window.HoverWave) HoverWave.write($0, $1); }, data, len);
        }
        MEM32(wh + 8) = 0;                     /* dwBytesRecorded */
        MEM32(wh + 16) |= WHDR_DONE;
        MEM32(wh + 16) &= ~WHDR_INQUEUE;
    }
    RET(MMSYSERR_NOERROR, 3);
}
static void w_waveOutGetPosition(void) { if (A32(1)) MEM32(A32(1)) = 0; RET(MMSYSERR_NOERROR, 2); }
static void w_waveOutPause(void)   { RET(MMSYSERR_NOERROR, 1); }
static void w_waveOutRestart(void) { RET(MMSYSERR_NOERROR, 1); }
static void w_waveOutPrepareHeader(void) {
    uint32_t wh = A32(1); if (wh) MEM32(wh + 16) |= WHDR_PREPARED; RET(MMSYSERR_NOERROR, 3);
}
static void w_waveOutUnprepareHeader(void) {
    uint32_t wh = A32(1); if (wh) { MEM32(wh + 16) &= ~WHDR_PREPARED; MEM32(wh + 16) |= WHDR_DONE; }
    RET(MMSYSERR_NOERROR, 3);
}
static void w_waveOutGetNumDevs(void) { RET(1, 0); }
static void w_waveOutGetDevCapsA(void) {
    uint32_t caps = A32(0), size = A32(2);
    if (caps && size >= 4) MEM32(caps) = 2, MEM32(caps + 4) = 2, MEM32(caps + 8) = 2;
    RET(MMSYSERR_NOERROR, 3);
}
static void w_waveOutSetVolume(void)  { RET(MMSYSERR_NOERROR, 2); }
static void w_waveOutGetVolume(void)  { if (A32(1)) MEM32(A32(1)) = 0xFFFFFFFFu; RET(MMSYSERR_NOERROR, 2); }
static void w_waveOutGetID(void)      { if (A32(1)) MEM32(A32(1)) = 0; RET(MMSYSERR_NOERROR, 2); }
static void w_sndPlaySoundA(void) {            /* (lpszSound, flags) */
    uint32_t name = A32(0);
    if (name) EM_ASM_({ if (window.HoverWave) HoverWave.sndPlay($0, $1); }, name, A32(1));
    RET(1, 2);
}

/* ---------------- MIDI out + stream: events go to the JS synth ---------------- */
static int g_midi_open;

static void d_midiOutGetNumDevs(void) { RET(1, 0); }
static void d_midiOutGetDevCapsA(void) {
    uint32_t caps = A32(0), size = A32(2);
    if (caps && size >= 8) {
        memset((void *)(uintptr_t)caps, 0, size >= 84 ? 84 : size);
        memcpy((void *)(uintptr_t)caps, "Microsoft GS Wavetable Synth", 29);
    }
    RET(MMSYSERR_NOERROR, 4);
}
static void d_midiOutPrepareHeader(void) {
    uint32_t mh = A32(1); if (mh) MEM32(mh + 16) |= MHDR_PREPARED; RET(MMSYSERR_NOERROR, 3);
}
static void d_midiOutUnprepareHeader(void) {
    uint32_t mh = A32(1); if (mh) { MEM32(mh + 16) &= ~MHDR_PREPARED; MEM32(mh + 16) |= MHDR_DONE; }
    RET(MMSYSERR_NOERROR, 3);
}
static void d_midiOutReset(void) {
    emscripten_run_script("window.HoverMidi && HoverMidi.reset()");
    RET(MMSYSERR_NOERROR, 1);
}
static void d_midiStreamOpen(void) {           /* (&h, puDeviceID, cMidi, dwCallback, dwInstance, fdwOpen) */
    uint32_t ph = A32(0);
    if (ph) MEM32(ph) = 0x00D1C0DEu;
    g_midi_open = 1;
    emscripten_run_script("window.HoverMidi && HoverMidi.open()");
    RET(MMSYSERR_NOERROR, 6);
}
static void d_midiStreamOut(void) {            /* (h, pmh, cbmh) */
    uint32_t mh = A32(1);
    if (mh) {
        uint32_t data = MEM32(mh + 0), len = MEM32(mh + 8); /* lpData, dwBytesRecorded */
        if (data && len)
            EM_ASM_({ if (window.HoverMidi) HoverMidi.stream($0, $1); }, data, len);
        MEM32(mh + 16) |= MHDR_DONE | MHDR_PREPARED;
    }
    RET(MMSYSERR_NOERROR, 3);
}
static void d_midiStreamReset(void) {
    emscripten_run_script("window.HoverMidi && HoverMidi.reset()");
    RET(MMSYSERR_NOERROR, 1);
}
static void d_midiStreamClose(void) { g_midi_open = 0; RET(MMSYSERR_NOERROR, 1); }
static void d_midiOutGetPosition_h(void) { RET(web_now_ms(), 2); }
static void d_midiOutOpen(void) {              /* (&h, dev, cb, inst, flags) */
    uint32_t ph = A32(0);
    if (ph) MEM32(ph) = 0x00D1C0DFu;
    emscripten_run_script("window.HoverMidi && HoverMidi.open()");
    RET(MMSYSERR_NOERROR, 5);
}
static void d_midiOutShortMsg(void) {          /* (h, msg) */
    EM_ASM_({ if (window.HoverMidi) HoverMidi.short($1); }, A32(0), A32(1));
    RET(MMSYSERR_NOERROR, 2);
}
static void d_midiOutClose(void) { RET(MMSYSERR_NOERROR, 1); }

/* ---------------- joystick: none ---------------- */
static void d_joyGetPos(void) { RET(JOYERR_UNPLUGGED, 2); }
static void d_joyGetDevCapsA(void) { RET(JOYERR_UNPLUGGED, 3); }
static void d_joyGetPosEx(void) { RET(JOYERR_UNPLUGGED, 3); }

const win32hle_shim *win32hle_web_winmm_shims(void);

static const win32hle_shim g_winmm_web[] = {
    { "timeGetTime",          NULL },          /* bound in web_host.c (needs the clock) */
    { "timeSetEvent",         m_timeSetEvent },
    { "timeKillEvent",        m_timeKillEvent },
    { "timeBeginPeriod",      NULL },
    { "waveOutOpen",          w_waveOutOpen },
    { "waveOutClose",         w_waveOutClose },
    { "waveOutReset",         w_waveOutReset },
    { "waveOutWrite",         w_waveOutWrite },
    { "waveOutGetPosition",   w_waveOutGetPosition },
    { "waveOutPause",         w_waveOutPause },
    { "waveOutRestart",       w_waveOutRestart },
    { "waveOutPrepareHeader", w_waveOutPrepareHeader },
    { "waveOutUnprepareHeader", w_waveOutUnprepareHeader },
    { "waveOutGetNumDevs",    w_waveOutGetNumDevs },
    { "waveOutGetDevCapsA",   w_waveOutGetDevCapsA },
    { "waveOutSetVolume",     w_waveOutSetVolume },
    { "waveOutGetVolume",     w_waveOutGetVolume },
    { "waveOutGetID",         w_waveOutGetID },
    { "sndPlaySoundA",        w_sndPlaySoundA },
    { "midiOutGetNumDevs",    d_midiOutGetNumDevs },
    { "midiOutGetDevCapsA",   d_midiOutGetDevCapsA },
    { "midiOutPrepareHeader", d_midiOutPrepareHeader },
    { "midiOutUnprepareHeader", d_midiOutUnprepareHeader },
    { "midiOutReset",         d_midiOutReset },
    { "midiOutOpen",          d_midiOutOpen },
    { "midiOutShortMsg",      d_midiOutShortMsg },
    { "midiOutClose",         d_midiOutClose },
    { "midiStreamOpen",       d_midiStreamOpen },
    { "midiStreamOut",        d_midiStreamOut },
    { "midiStreamReset",      d_midiStreamReset },
    { "midiStreamClose",      d_midiStreamClose },
    { "midiStreamProperty",   d_midiStreamReset },
    { "midiStreamPosition",   d_midiOutGetPosition_h },
    { "midiStreamPause",      d_midiStreamReset },
    { "midiStreamRestart",    d_midiStreamReset },
    { "midiStreamStop",       d_midiStreamReset },
    { "joyGetPos",            d_joyGetPos },
    { "joyGetDevCapsA",       d_joyGetDevCapsA },
    { "joyGetPosEx",          d_joyGetPosEx },
    { NULL, NULL }
};

/* two entries need real code: fill them here */
static void m_timeGetTime(void) { RET(web_now_ms(), 0); }
static void m_timeBeginPeriod(void) { RET(MMSYSERR_NOERROR, 1); }


/* ---------------- mmio: real file-backed RIFF I/O (sounds, music) ------- */
#define MMIOERR_UNSEEKABLE 3u
typedef struct { int is_mem; int fd; uint32_t buf, size; long pos; int valid; } mmh_t;
static mmh_t g_mmh[16];

static FILE *mmio_fopen_ci(const char *path) {   /* case-insensitive on MEMFS */
    FILE *f = fopen(path, "rb");
    if (f) return f;
    char fixed[512];
    const char *p = path;
    char *o = fixed;
    while (*p && o < fixed + sizeof fixed - 2) {
        if (*p == '/' || *p == '\\') { *o++ = *p++; continue; }
        /* match one segment case-insensitively */
        char seg[128]; int sl = 0;
        const char *q = p;
        while (*q && *q != '/' && *q != '\\' && sl < 127) seg[sl++] = *q++;
        seg[sl] = 0;
        char dir[512];
        size_t dl = (size_t)(p - path);
        if (dl >= sizeof dir) break;
        memcpy(dir, path, dl); dir[dl] = 0;
        if (!dl || dir[0] == 0) strcpy(dir, "/");
        DIR *d = opendir(dir[0] ? dir : "/");
        int found = 0;
        if (d) {
            struct dirent *e;
            while ((e = readdir(d))) {
                if (strcasecmp(e->d_name, seg) == 0) {
                    size_t n = strlen(dir), l = strlen(e->d_name);
                    if (dir[n-1] != '/') dir[n++] = '/';
                    if (dl + l < sizeof fixed - 2) { memcpy(o, e->d_name, l); o += l; }
                    found = 1;
                    break;
                }
            }
            closedir(d);
        }
        if (!found) return NULL;
        p = q;
        *o = 0;
        f = fopen(fixed, "rb");
        if (f) return f;
        /* continue walking with the fixed prefix: restart from fixed */
        path = fixed;
        o = fixed + strlen(fixed);
        if (!*p) break;
        continue;
    }
    return NULL;
}

static void m_mmioOpenA(void) {                /* (name, lpMMIOInfo, flags) */
    uint32_t name = A32(0), info = A32(1);
    if (!name && !info) RET(0, 3);
    { static int nprobe = 0; if (nprobe++ < 6)
        fprintf(stderr, "[mmioO] name=%u info=%u info+4=%08X info+20=%u info+24=%u\n",
                name, info, info ? MEM32(info + 4) : 0, info ? MEM32(info + 20) : 0, info ? MEM32(info + 24) : 0); }
    if (info && MEM32(info + 4) == 0x204D454Du) {         /* 'MEM ' */
        uint32_t buf = MEM32(info + 24), size = MEM32(info + 20);
        if (!size) size = MEM32(info + 48);               /* adwInfo[0] */
        if (!buf) buf = MEM32(info + 52);                 /* adwInfo[1] */
        for (int i = 0; i < 16; i++) if (!g_mmh[i].valid) {
            g_mmh[i] = (mmh_t){ .is_mem = 1, .buf = buf, .size = size, .pos = 0, .valid = 1 };
            MEM32(info + 28) = buf;                        /* pchNext */
            MEM32(info + 32) = buf + size;                 /* pchEndRead */
            MEM32(info + 36) = buf + size;                 /* pchEndWrite */
            MEM32(info + 44) = 0;                          /* lDiskOffset */
            MEM32(info + 12) = 0;                          /* wErrorRet */
            RET(0xD100 + (uint32_t)i, 3);
            return;
        }
        RET(0, 3);
        return;
    }
    /* the guest path (C:\HOVER\...) must go through the drive mapping */
    char host[512];
    char guest[300];
    snprintf(guest, sizeof guest - 1, "%s", (const char *)hle_ptr(name));
    guest[sizeof guest - 1] = 0;
    if (!hle_host_path(guest, host, sizeof host)) {
        fprintf(stderr, "[mmio] no drive for: %s\n", guest);
        RET(0, 3);
        return;
    }
    FILE *f = mmio_fopen_ci(host);
    { static int n_log = 0; if (n_log++ < 4) fprintf(stderr, "[mmio] '%s' -> '%s' f=%p\n", guest, host, (void *)f); }
    if (!f) { fprintf(stderr, "[mmio] open failed: %s\n", host); RET(0, 3); return; }
    for (int i = 0; i < 16; i++) if (!g_mmh[i].valid) {
        g_mmh[i] = (mmh_t){ .is_mem = 0, .fd = (int)(intptr_t)f, .pos = 0, .valid = 1 };
        RET(0xD000 + (uint32_t)i, 3);
        return;
    }
    fclose(f);
    RET(0, 3);
}
static mmh_t *mmh(uint32_t h) {
    if (h >= 0xD000 && h < 0xD010 && g_mmh[h - 0xD000].valid) return &g_mmh[h - 0xD000];
    if (h >= 0xD100 && h < 0xD110 && g_mmh[h - 0xD100].valid) return &g_mmh[h - 0xD100];
    return NULL;
}
static void m_mmioClose(void) {
    mmh_t *m = mmh(A32(0));
    if (m) { if (!m->is_mem) fclose((FILE *)(intptr_t)m->fd); m->valid = 0; }
    RET(0, 1);
}
static void m_mmioRead(void) {
    mmh_t *m = mmh(A32(0));
    if (!m) RET((uint32_t)-1, 3);
    uint32_t n = A32(2);
    if (m->is_mem) {
        long avail = (long)m->size - m->pos;
        if (avail < 0) avail = 0;
        if (n > (uint32_t)avail) n = (uint32_t)avail;
        if (n) memcpy((void *)hle_ptr(A32(1)), (const void *)hle_ptr(m->buf + m->pos), n);
        m->pos += (long)n;
        RET(n, 3);
        return;
    }
    FILE *f = (FILE *)(intptr_t)m->fd;
    fseek(f, m->pos, SEEK_SET);
    size_t r = fread((void *)hle_ptr(A32(1)), 1, n, f);
    m->pos += (long)r;
    { static int nr = 0; if (nr++ < 12) fprintf(stderr, "[mmioR] h=%u n=%u read=%zu pos->%ld\n", A32(0), n, r, m->pos); }
    RET((uint32_t)r, 3);
}
static void m_mmioSeek_d(void);
static void m_mmioDescend(void) {              /* (h, pmmck, pmmckParent, flags) */
    mmh_t *m = mmh(A32(0));
    if (!m) RET(MMIOERR_UNSEEKABLE, 4);
    uint32_t ck = A32(1), parent = A32(2), flags = A32(3);
    if (m->is_mem) {
        long scan = m->pos;
        uint32_t want = ck ? MEM32(ck) : 0;
        uint32_t flags = A32(3);
        /* 0 = MMIO_FINDRIFF (a RIFF whose form type is want), 1 = MMIO_FINDLIST,
         * 4 = MMIO_FINDCHUNK (a chunk whose ID is want) */
        int mode = (flags == 1u) ? 1 : ((flags == 4u) ? 4 : 0);
        while (scan + 8 <= (long)m->size) {
            uint32_t hdr0 = MEM32(m->buf + scan), hdr1 = MEM32(m->buf + scan + 4);
            uint32_t form = (scan + 12 <= (long)m->size) ? MEM32(m->buf + scan + 8) : 0;
            int match = 1;
            if (mode == 0) match = (hdr0 == 0x46464952u /*RIFF*/ && form == want);
            else if (mode == 1) match = (hdr0 == 0x5453494Cu /*LIST*/ && form == want);
            else match = (hdr0 == want);
            if (parent) {
                long pstart = (long)MEM32(parent + 8), pend = pstart + (long)MEM32(parent + 4);
                if (scan < pstart || scan + 8 > pend) match = 0;
            }
            if (match) {
                if (ck) {
                    MEM32(ck) = hdr0;
                    MEM32(ck + 4) = hdr1;
                    MEM32(ck + 8) = (uint32_t)(mode == 4 ? scan + 8 : scan + 12);
                    MEM32(ck + 12) = form;
                }
                m->pos = (mode == 4) ? scan + 8 : scan + 12;
                { static int nd = 0; if (nd++ < 10) fprintf(stderr, "[mmioD] mem ck=%08X size=%u pos->%ld\n", hdr0, hdr1, m->pos); }
                RET(0, 4);
                return;
            }
            scan += 8 + (long)hdr1 + (hdr1 & 1);
        }
        RET(0x101u, 4);
        return;
    }
    FILE *f = (FILE *)(intptr_t)m->fd;
    long start = m->pos;
    uint32_t want = ck ? MEM32(ck) : 0;
    /* 0 = MMIO_FINDRIFF (a RIFF whose form type is want), 1 = MMIO_FINDLIST,
     * 4 = MMIO_FINDCHUNK (a chunk whose ID is want); else: chunk ID match */
    int mode = (flags == 1u) ? 1 : ((flags == 4u) ? 4 : 0);
    long scan = start;
    for (;;) {
        uint32_t hdr[2], form = 0;
        if (fseek(f, scan, SEEK_SET) != 0 || fread(hdr, 1, 8, f) != 8) {
            { static int nf = 0; if (nf++ < 8) fprintf(stderr, "[mmioD] FILE walk-end pos=%ld\n", scan); }
            break;
        }
        if (mode != 4) {
            if (fseek(f, scan + 8, SEEK_SET) != 0 || fread(&form, 1, 4, f) != 4) form = 0;
        }
        { static int ng = 0; if (ng++ < 10) fprintf(stderr, "[mmioD] FILE ck=%c%c%c%c form=%08X size=%u scan=%ld\n", (hdr[0]&255), ((hdr[0]>>8)&255), ((hdr[0]>>16)&255), ((hdr[0]>>24)&255), form, hdr[1], scan); }
        uint32_t size = hdr[1];
        int match = 1;
        if (mode == 0) match = (hdr[0] == 0x46464952u /*RIFF*/ && form == want);
        else if (mode == 1) match = (hdr[0] == 0x5453494Cu /*LIST*/ && form == want);
        else match = (hdr[0] == want);
        if (parent) {                            /* must be inside the parent chunk */
            long pstart = MEM32(parent + 8), pend = pstart + (long)MEM32(parent + 4);
            if (scan < pstart || scan + 8 > pend) match = 0;
        }
        if (match) {
            if (ck) {
                MEM32(ck) = hdr[0];
                MEM32(ck + 4) = size;
                MEM32(ck + 8) = (uint32_t)((mode == 4) ? scan + 8 : scan + 12);
                MEM32(ck + 12) = (mode == 4) ? 0 : form;
            }
            m->pos = (mode == 4) ? scan + 8 : scan + 12;
            { static int nd = 0; if (nd++ < 12) fprintf(stderr, "[mmioD] hit mode=%d size=%u pos->%ld\n", mode, size, m->pos); }
            RET(0, 4);                           /* MMSYSERR_NOERROR */
        }
        scan += 8 + size + (size & 1);
    }
    RET(0x101u, 4);                              /* MMIOERR_CHUNKNOTFOUND */
}
static void m_mmioAscend(void) {               /* (h, pmmck, flags) */
    mmh_t *m = mmh(A32(0));
    if (!m) RET(MMIOERR_UNSEEKABLE, 3);
    uint32_t ck = A32(1);
    if (ck) m->pos = (long)MEM32(ck + 8) + 8 + MEM32(ck + 4) + (MEM32(ck + 4) & 1);
    RET(0, 3);
}

const win32hle_shim *win32hle_web_mmio_shims(void);
static const win32hle_shim g_mmio[] = {
    { "mmioOpenA", m_mmioOpenA }, { "mmioRead", m_mmioRead },
    { "mmioClose", m_mmioClose }, { "mmioDescend", m_mmioDescend },
    { "mmioAscend", m_mmioAscend },
    { NULL, NULL }
};
const win32hle_shim *win32hle_web_mmio_shims(void) { return g_mmio; }

const win32hle_shim *win32hle_web_winmm_shims(void) {
    static win32hle_shim t[sizeof g_winmm_web / sizeof g_winmm_web[0]];
    int n = 0;
    for (const win32hle_shim *s = g_winmm_web; s->name; s++, n++) t[n] = *s;
    t[0].fn = m_timeGetTime;                   /* timeGetTime */
    for (int i = 0; i < n; i++)
        if (!strcmp(t[i].name, "timeBeginPeriod")) t[i].fn = m_timeBeginPeriod;
    return t;
}
