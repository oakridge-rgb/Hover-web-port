#!/usr/bin/env python3
"""Extract and decompress the gzip-base64 blobs inside STORM0S.html"""
import re, base64, gzip, io, os, json

s = open('/home/z/my-project/scripts/out/stormos/STORM0S.html', encoding='utf-8', errors='replace').read()

blobs = []
for m in re.finditer(r'>?(H4sIA[A-Za-z0-9+/=]+)', s):
    blobs.append((m.start(), m.group(1)))

print(f"found {len(blobs)} gzip blobs")
os.makedirs('/home/z/my-project/scripts/out/stormos/blobs', exist_ok=True)

out = []
for i,(pos,b64) in enumerate(blobs):
    try:
        raw = base64.b64decode(b64)
        data = gzip.decompress(raw)
        path = f'/home/z/my-project/scripts/out/stormos/blobs/blob_{i:02d}_pos{pos}.txt'
        with open(path,'wb') as f: f.write(data)
        head = data[:300].decode('utf-8', errors='replace').replace('\n',' ')
        out.append((i,pos,len(b64),len(data),head))
        print(f"[{i:02d}] pos={pos} b64len={len(b64):,} gunzipped={len(data):,} head={head[:180]}")
    except Exception as e:
        print(f"[{i:02d}] pos={pos} FAIL: {e}")

with open('/home/z/my-project/scripts/out/stormos/blobs/index.json','w') as f:
    json.dump(out, f, indent=1)
