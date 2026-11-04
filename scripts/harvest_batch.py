#!/usr/bin/env python3
"""Batch-harvest wisp wss:// URLs: processes repos from a queue file, N per run."""
import subprocess, re, os, sys, json

UA = "Mozilla/5.0 (X11; Linux x86_64) Firefox/125.0"
QUEUE = "/tmp/wisp_queue.txt"
FOUND = "/tmp/wisp_found.json"
TMP = "/tmp/wispharvest"

def fetch_and_grep(repo):
    d = os.path.join(TMP, "x")
    subprocess.run(["rm", "-rf", TMP], capture_output=True)
    os.makedirs(d, exist_ok=True)
    got = False
    for br in ("main", "master"):
        url = f"https://codeload.github.com/{repo}/tar.gz/refs/heads/{br}"
        r = subprocess.run(["curl", "-s", "-L", "--max-time", "50", "-A", UA, url],
                           capture_output=True, timeout=60)
        if r.returncode == 0 and r.stdout and len(r.stdout) > 500 and b"<html" not in r.stdout[:300].lower():
            p = os.path.join(TMP, "t.tgz")
            open(p, "wb").write(r.stdout)
            if subprocess.run(["tar", "xzf", p, "-C", d], capture_output=True, timeout=60).returncode == 0:
                got = True
                break
    if not got:
        return None
    p1 = subprocess.run(["grep", "-rniE", "wss?://", "--include=*.js", "--include=*.mjs",
                         "--include=*.ts", "--include=*.json", "--include=*.html",
                         "--include=*.svelte", "--include=*.vue", "--include=*.jsx",
                         "--include=*.tsx", "--include=*.css", d],
                        capture_output=True, text=True, timeout=120)
    urls = set()
    BAD = ("scratch", "turbowarp", "mc.", "asspixel", "vanilla", "zentic", "eponesh",
           "hellscaped", "arch.lol", "aeon-network", "deev.is", "lax1dude",
           "shhnowisnottheti", "gateway.discord", "example", "localhost", "127.0.0.1")
    for line in p1.stdout.splitlines():
        low = line.lower()
        kw = any(k in low for k in ("wisp", "epoxy", "scramjet", "transport", "proxy"))
        fname = line.split(":", 2)[0].lower() if ":" in line else ""
        cfg = any(k in fname for k in ("config", "setting", "wisp", "transport", "const", "server"))
        if not (kw or cfg):
            continue
        for u in re.findall(r'wss?://[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+', line, re.I):
            u = u.rstrip('",\'`)]}.;\\')
            if "example" in u or "localhost" in u or "127.0.0.1" in u or "your" in u or "host/path" in u or u.endswith("wss://") or u.endswith("ws://"):
                continue
            if any(b in u.lower() for b in BAD):
                continue
            urls.add(u)
    return sorted(urls)

def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    if not os.path.exists(QUEUE):
        print("no queue"); return
    repos = [l.strip() for l in open(QUEUE) if l.strip()]
    batch, rest = repos[:n], repos[n:]
    open(QUEUE, "w").write("\n".join(rest) + ("\n" if rest else ""))
    found = {}
    if os.path.exists(FOUND):
        try: found = json.load(open(FOUND))
        except Exception: found = {}
    for repo in batch:
        try:
            urls = fetch_and_grep(repo)
        except Exception as e:
            urls = None
        if urls:
            found[repo] = urls
            print(f"{repo}: {len(urls)} -> {urls[:4]}", flush=True)
        else:
            print(f"{repo}: {'fetch-fail' if urls is None else 'none'}", flush=True)
    json.dump(found, open(FOUND, "w"), indent=1)
    total = set()
    for v in found.values(): total.update(v)
    print(f"[queue left: {len(rest)}] total unique URLs so far: {len(total)}", flush=True)

main()
