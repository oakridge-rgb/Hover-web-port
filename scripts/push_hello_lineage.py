#!/usr/bin/env python3
"""
push_hello_lineage.py — create the HelloLineage repo on the token's GitHub
account and upload the full tree from download/HelloLineage/ (README, docs/,
scripts/, LICENSE, .gitignore).

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
DESC = ('LineageOS GSI on the Moto G Power 5G 2024 (cancunn) the OneLineage/OneOS way: '
        'container GSI on a locked bootloader with DFRoot root, plus the real fastbootd flash route.')


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


def collect_files():
    out = []
    for root, dirs, files in os.walk(SRC):
        dirs[:] = sorted(d for d in dirs if d not in ('.git',))
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, SRC).replace(os.sep, '/')
            out.append((rel, full))
    return out


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

    files = collect_files()
    log(f'{len(files)} files to upload from {SRC}')
    for rel, path in files:
        data = open(path, 'rb').read()
        if rel == 'scripts/check-device.sh':
            data = data.replace(b'\r\n', b'\n')  # keep LF for on-device sh

        # existing file? then its sha is required for the update
        _, cur = api('GET', f'/repos/{full}/contents/{rel}?ref=main', tok)
        body = {'message': f'add {rel}',
                'content': base64.b64encode(data).decode(),
                'branch': 'main'}
        if cur and cur.get('sha'):
            body['sha'] = cur['sha']

        code, r = retry(lambda: api('PUT', f'/repos/{full}/contents/{rel}', tok, body),
                        f'contents {rel}')
        if code not in (200, 201):
            log(f'UPLOAD FAILED {rel}: HTTP {code} {r.get("message", "?")}'); sys.exit(4)
        log(f'  committed: {rel} ({len(data)} bytes)')

    log(f'COMMITTED to {full}@main')
    log('')
    log(f'REPO LIVE: https://github.com/{full}')
    log(f'Raw README: https://raw.githubusercontent.com/{full}/main/README.md')


if __name__ == '__main__':
    main()
