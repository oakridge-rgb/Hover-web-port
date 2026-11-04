#!/usr/bin/env python3
"""Patch the FATE engine (gn-math.html) with the big wisp relay pool.

1. Replace the 5-endpoint template literal in UI=Yt(`...`) with the
   verified relay pool (80 endpoints / 52 hosts).
2. Widen CSP connect-src to allow ANY wss:// relay (wss: scheme source).
3. Raise the scanner's wave size clamp 12 -> 64 so hundreds of relays
   are probed in 1-2 parallel waves instead of many sequential waves.

Idempotent-ish: refuses to run if the engine was already patched.
"""
import shutil
import sys

SITE = "/home/z/my-project/download/site/gn-math.html"
LIST = "/tmp/final_wisp_list.txt"
BACKUP = "/tmp/gn-math.html.pre-wisp-pool"

old_tpl_start = "UI=Yt(`"
old_tpl_end = "`)"

old_csp = ("wss://arctic.lat/_q/ wss://arctic.lat/wisp/ wss://wisp.mercurywork.shop/wisp/ "
           "wss://wisp.mercurywork.shop/ wss://anura.pro/")
new_csp = "wss:"

old_wave = "this.waveSize=Math.max(1,Math.min(12,g.waveSize??12))"
new_wave = "this.waveSize=Math.max(1,Math.min(64,g.waveSize??64))"

HEADER = (
    "# FATE relay pool - 80 endpoints / 52 hosts, handshake+HTTP verified 2026-11-04\n"
    "# lines starting with # are ignored; add your own wss:// relay below to pin it\n"
)

def main():
    s = open(SITE, encoding="utf-8").read()
    if old_wave not in s and new_wave in s:
        print("already patched, aborting")
        sys.exit(1)

    shutil.copy2(SITE, BACKUP)

    # 1. endpoint template literal
    i = s.index(old_tpl_start)
    j = s.index(old_tpl_end, i)
    inside = s[i + len(old_tpl_start):j]
    assert inside.count("wss://") == 5, f"unexpected old list content ({inside.count('wss://')} urls)"
    urls = [l.strip() for l in open(LIST) if l.strip()]
    assert all(u.startswith("wss://") for u in urls) and len(urls) == len(set(urls))
    s = s[:i + len(old_tpl_start)] + "\n" + HEADER + "\n".join(urls) + "\n" + s[j:]

    # 2. CSP
    assert s.count(old_csp) == 1, s.count(old_csp)
    s = s.replace(old_csp, new_csp)

    # 3. wave size
    assert s.count(old_wave) == 1
    s = s.replace(old_wave, new_wave)

    open(SITE, "w", encoding="utf-8").write(s)

    # verify
    v = open(SITE, encoding="utf-8").read()
    a = v.index("UI=Yt(`")
    b = v.index("`)", a)
    body = v[a:b]
    n = body.count("wss://")
    print(f"patched OK: {n} relay URLs in pool, CSP wss: allowed={new_csp in v}, wave64={new_wave in v}")
    assert n == len(urls), (n, len(urls))

if __name__ == "__main__":
    main()
