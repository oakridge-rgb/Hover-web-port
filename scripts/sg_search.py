#!/usr/bin/env python3
"""Query Sourcegraph public code search for wisp server URL lists."""
import sys, json, subprocess, re, urllib.parse, time

def search(query, timeout=90):
    url = "https://sourcegraph.com/.api/search/stream?q=" + urllib.parse.quote(query) + "&v=V3"
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", str(timeout), url, "-H", "Accept: text/event-stream"],
            capture_output=True, text=True, timeout=timeout + 5
        ).stdout
    except Exception as e:
        print(f"[!] {query}: {e}", file=sys.stderr)
        return []
    files = {}  # repo:path -> set of wss urls found in content
    for line in out.splitlines():
        if not line.startswith("data: "):
            continue
        raw = line[6:]
        try:
            evt = json.loads(raw)
        except Exception:
            continue
        if not isinstance(evt, list):
            continue
        for m in evt:
            if not isinstance(m, dict) or m.get("type") != "content":
                continue
            repo = (m.get("repository") or "").replace("github.com/", "")
            path = m.get("path", "")
            chunks = m.get("chunkMatches", [])
            content = m.get("content", "")
            text = content + "\n" + "\n".join(c.get("content", "") for c in chunks)
            urls = set(re.findall(r'wss?://[A-Za-z0-9._~:/?#\[\]@!$&\'()*+,;=%-]+', text))
            urls = {u.rstrip('",\'`)]}.;') for u in urls}
            if urls:
                files.setdefault(f"{repo}::{path}", set()).update(urls)
    return files

if __name__ == "__main__":
    queries = [
        '"wisp.mercurywork.shop" fork:yes archived:yes count:150',
        '"arctic.lat" wisp fork:yes count:100',
        '"wisp://" fork:yes count:100 type:file',
    ]
    all_files = {}
    for q in queries:
        print(f"== {q}", file=sys.stderr)
        res = search(q)
        for k, v in res.items():
            all_files.setdefault(k, set()).update(v)
        print(f"   -> {len(res)} files", file=sys.stderr)
        time.sleep(2)
    for k in sorted(all_files):
        print(k)
        for u in sorted(all_files[k]):
            print("   ", u)
