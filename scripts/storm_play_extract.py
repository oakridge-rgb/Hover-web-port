#!/usr/bin/env python3
"""Extract the play() player logic from STORM0S.html around known positions"""
import re
s=open('/home/z/my-project/scripts/out/stormos/STORM0S.html',encoding='utf-8',errors='replace').read()

# The main play() body: pull a wide window around the fetchGame block at 14852856
start = 14849000
end   = 14876000
chunk = s[start:end]
open('/home/z/my-project/scripts/out/stormos/play_extract.js','w').write(chunk)
print("saved play_extract.js, len", len(chunk))

# also find the 'unpack' helper and 'retrieve' helper and stormProxyURL
for name in ['async function unpack','function unpack','const unpack','async function retrieve','function retrieve','const retrieve','stormProxyURL','frameFallback']:
    for m in re.finditer(re.escape(name), s):
        print(f"{name!r} @ {m.start()}")
