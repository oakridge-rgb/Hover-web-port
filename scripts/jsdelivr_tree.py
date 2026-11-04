#!/usr/bin/env python3
"""List file trees of GitHub repos via jsDelivr API (no auth needed)."""
import json, subprocess, sys

REPOS = [
    ("interstellarnetwork/interstellar", "main"),
    ("Metallic-Web/Metallic", "main"),
    ("dotgui-dev/DotGUI", "main"),
    ("Bolt-Network/Bolt-Unblocker", "main"),
    ("chemicaljs/chemical", "main"),
    ("amethystnetwork-dev/Incognito", "main"),
    ("Aluminum-Depot/Tinf0il", "main"),
    ("MercuryWorkshop/AnuraOS", "main"),
    ("rhenryw/deployWisp", "main"),
    ("rykcbaoolNEW/static-scram", "main"),
]

KEY = ("wisp", "config", "setting", "transport", "const", "env", "url", "endpoint", "api")

for repo, br in REPOS:
    url = f"https://data.jsdelivr.com/v1/packages/gh/{repo}@{br}?structure=flat"
    try:
        out = subprocess.run(["curl", "-s", "--max-time", "25", url],
                             capture_output=True, text=True, timeout=30).stdout
        d = json.loads(out)
        files = d.get("files", [])
        if not files:
            print(f"== {repo}: NO TREE (branch {br}?)")
            continue
        print(f"== {repo} ({len(files)} files)")
        for f in files:
            p = f["name"]
            low = p.lower()
            if p.endswith((".js", ".mjs", ".ts", ".json", ".html", ".svelte", ".toml", ".env", ".yaml", ".yml")) and \
               any(k in low for k in KEY) and "node_modules" not in p and len(p) < 90:
                print("   ", p)
    except Exception as e:
        print(f"== {repo}: ERR {e}")
