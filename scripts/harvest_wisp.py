#!/usr/bin/env python3
"""Harvest wisp wss:// URLs from GitHub repos via codeload tarballs (no API limits)."""
import subprocess, re, os, sys, tarfile, io, json

UA = "Mozilla/5.0 (X11; Linux x86_64) Firefox/125.0"

def gh_repo_search(query, n=25):
    """Search github repos HTML page, return [(owner/repo, stars_desc_order)]."""
    url = f"https://github.com/search?q={query}&type=repositories&s=stars&o=desc"
    try:
        t = subprocess.run(["curl", "-s", "-L", "--max-time", "30", "-A", UA, url],
                           capture_output=True, text=True, timeout=35).stdout
    except Exception:
        return []
    repos, seen = [], set()
    for m in re.findall(r'href="/([\w.-]+/[\w.-]+)"', t):
        low = m.lower()
        if m in seen or m.count("/") != 1:
            continue
        if any(s in low for s in ("features", "topics", "collections", "trending", "sponsors",
                                  "security", "login", "signup", "pricing", "search", "settings",
                                  "notifications", "explore", "about", "customer-stories",
                                  "site/", "events", "marketplace", "apps", "readme", "issues",
                                  "pulls", "orgs", "showcases", "interests", "footer")):
            continue
        seen.add(m)
        repos.append(m)
    return repos[:n]

def fetch_tarball(repo, tmpdir):
    for br in ("main", "master"):
        url = f"https://codeload.github.com/{repo}/tar.gz/refs/heads/{br}"
        r = subprocess.run(["curl", "-s", "-L", "--max-time", "90", "-A", UA, url],
                           capture_output=True, timeout=100)
        if r.returncode == 0 and r.stdout and len(r.stdout) > 500 and b"<html" not in r.stdout[:200].lower():
            path = os.path.join(tmpdir, "t.tar.gz")
            with open(path, "wb") as f:
                f.write(r.stdout)
            try:
                d = os.path.join(tmpdir, "x")
                os.makedirs(d, exist_ok=True)
                subprocess.run(["tar", "xzf", path, "-C", d], timeout=60, check=False)
                return d
            except Exception:
                return None
    return None

def grep_wisp(root):
    """grep -r for lines with wss:// AND wisp, plus wss:// in config-ish files."""
    urls = {}
    p1 = subprocess.run(["grep", "-rniE", "wss?://", "--include=*.js", "--include=*.mjs", "--include=*.ts",
                         "--include=*.json", "--include=*.html", "--include=*.svelte", "--include=*.toml",
                         "--include=*.vue", "--include=*.jsx", "--include=*.tsx", "--include=*.env*", ".",
                         root], capture_output=True, text=True, timeout=120)
    for line in p1.stdout.splitlines():
        if "wisp" not in line.lower():
            continue
        for u in re.findall(r'wss?://[A-Za-z0-9._~:/?#@!$&()*+,;=%-]+', line, re.I):
            u = u.rstrip('",\'`)]}.;\\')
            if u not in urls:
                urls[u] = line[:0]  # no need keep line
    return sorted(urls)

if __name__ == "__main__":
    queries = sys.argv[1:] or ['wisp%20servers', 'scramjet%20proxy', 'epoxy%20proxy',
                               'unblocked%20games%20proxy', 'ultraviolet%20scramjet']
    all_repos = []
    seen = set()
    for q in queries:
        for r in gh_repo_search(q):
            if r.lower() not in seen:
                seen.add(r.lower())
                all_repos.append(r)
    print(f"{len(all_repos)} repos discovered", flush=True)

    tmpdir = "/tmp/wispharvest"
    os.makedirs(tmpdir, exist_ok=True)
    found = {}
    for i, repo in enumerate(all_repos):
        safe = repo.replace("/", "__")
        d = fetch_tarball(repo, tmpdir)
        if not d:
            print(f"[{i+1}/{len(all_repos)}] {repo}: FETCH FAIL", flush=True)
            continue
        urls = grep_wisp(d)
        subprocess.run(["rm", "-rf", d])
        if urls:
            found[repo] = urls
            print(f"[{i+1}/{len(all_repos)}] {repo}: {len(urls)} URLs -> {urls[:6]}", flush=True)
        else:
            print(f"[{i+1}/{len(all_repos)}] {repo}: -", flush=True)

    with open("/tmp/wisp_harvest.json", "w") as f:
        json.dump(found, f, indent=1)
    print("saved /tmp/wisp_harvest.json")
