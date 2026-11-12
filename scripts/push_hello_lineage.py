#!/usr/bin/env python3
"""
push_hello_lineage.py — create the HelloLineage repo on the token's GitHub
account and upload README.md + PORTING.md from download/HelloLineage/.

Token: scripts/.gh-token or env GH_TOKEN (never printed).
Usage: python3 scripts/push_hello_lineage.py
"""
import base64, json, os, sys, time
import urllib.request, urllib.error

PROJECT = '/home/z/my-project'
SRC = f'{PROJECT}/download/HelloLineage'
TOKEN_FILE = f'{PROJECT}/scripts/.gh-token'
API = 'https://api.github.com'
REPO_NAME = 'HelloLineage'
DESC = 'LineageOS on Motorola — replace Hello UI. Official-build guide, GSI guide, and a OneLineage-style container port roadmap.'


def log(m):
    print(m, flush=True)


def api(method, path, tok, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body else None)
    req.add_header('Authorization', f'Bearer {tok}')
    req.add_header('Accept', 'application/vnd.github+json')
    req.add_header('User-Agent', 'hello-lineage-push')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            p = r.read()
            return r.status, (json.loads(p) if p else {})
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}


def retry(fn, what, tries=6):
    for i in range(tries):
        code, d = fn()
        if code in (200, 201):
            return code, d
        if code in (403, 409, 429, 500, 502, 503):
            log(f'  retry {what} (HTTP {code})'); time.sleep(2 ** i * 2); continue
        break
    return code, d


def main():
    tok = None
    if os.environ.get('GH_TOKEN'):
        tok = os.environ['GH_TOKEN'].strip()
    elif os.path.isfile(TOKEN_FILE):
        tok = open(TOKEN_FILE).read().strip()
    if not tok:
        log('NO TOKEN. Paste your token into scripts/.gh-token or set GH_TOKEN.')
        sys.exit(1)

    code, me = retry(lambda: api('GET', '/user', tok), 'auth')
    if code != 200:
        log(f'AUTH FAILED (HTTP {code}) — token invalid/expired?'); sys.exit(2)
    login = me['login']
    log(f'token OK -> account: {login}')

    full = f'{login}/{REPO_NAME}'
    code, r = api('GET', f'/repos/{full}', tok)
    if code == 200:
        log(f'repo {full} already exists — using it')
    else:
        code, r = retry(lambda: api('POST', '/user/repos', tok,
                                    {'name': REPO_NAME, 'description': DESC,
                                     'private': False, 'auto_init': False,
                                     'has_wiki': False}), 'create repo')
        if code not in (200, 201):
            log(f'REPO CREATE FAILED (HTTP {code}): {r.get("message", "?")}'); sys.exit(3)
        log(f'created repo: {full}')

    # upload files via Contents API — works even on a repo with zero commits
    msgs = {
        'README.md': 'README: 3 routes to LineageOS on Motorola (official build, GSI, container)',
        'PORTING.md': 'PORTING: OneLineage container approach adapted to Motorola Hello UI',
    }
    for name in ['README.md', 'PORTING.md']:
        data = open(f'{SRC}/{name}', 'rb').read()
        code, r = retry(lambda: api('PUT', f'/repos/{full}/contents/{name}', tok,
                                    {'message': msgs[name],
                                     'content': base64.b64encode(data).decode(),
                                     'branch': 'main'}), f'contents {name}')
        if code not in (200, 201):
            log(f'UPLOAD FAILED {name}: HTTP {code} {r.get("message", "?")}'); sys.exit(4)
        log(f'  committed: {name} ({len(data)} bytes)')

    log(f'COMMITTED to {full}@main')

    log('')
    log(f'REPO LIVE: https://github.com/{full}')
    log(f'Raw README: https://raw.githubusercontent.com/{full}/main/README.md')


if __name__ == '__main__':
    main()
