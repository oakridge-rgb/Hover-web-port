#!/usr/bin/env python3
"""Analyze the master STORM0S game catalog (blob_00)"""
import json, re
from collections import Counter

s = open('/home/z/my-project/scripts/out/stormos/blobs/blob_00_pos2089392.txt', encoding='utf-8', errors='replace').read()
# head starts with [{"name": ... — find end of JSON array
lib = json.loads(s)
print("TOTAL ENTRIES:", len(lib))

# fields
keys = Counter()
for e in lib[:2000]:
    keys.update(e.keys())
print("FIELDS:", dict(keys))

# by source
src = Counter(e.get('source','?') for e in lib)
print("\nBY SOURCE:")
for k,v in src.most_common(30):
    print(f"  {v:6,}  {k}")

# host frequency of urls
hosts = Counter()
for e in lib:
    u = e.get('url','')
    m = re.match(r'https?://([^/]+)', u)
    hosts[m.group(1) if m else '(relative/other)'] += 1
print("\nURL HOSTS (top 30):")
for k,v in hosts.most_common(30):
    print(f"  {v:6,}  {k}")

# sample entries
print("\nSAMPLES:")
for e in lib[:3] + lib[len(lib)//2:len(lib)//2+3] + lib[-3:]:
    print(" ", json.dumps({k:(v[:90] if isinstance(v,str) else v) for k,v in e.items()}, ensure_ascii=False)[:260])

# image host coverage
noimg = sum(1 for e in lib if not e.get('image'))
print("\nentries missing image:", noimg)
with open('/home/z/my-project/scripts/out/stormos/catalog_full.json','w') as f:
    json.dump(lib, f, ensure_ascii=False)
print("saved catalog_full.json")
