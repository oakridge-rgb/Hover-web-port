#!/usr/bin/env python3
"""Probe every game host in the Storm catalog: XFO / CSP / CORS / content-type / GET status.
Decides per-host play strategy: direct iframe vs fetch+blob vs drop."""
import json, re, concurrent.futures, collections
from urllib.parse import urlparse
import urllib.request

cat = json.load(open('/tmp/storm-catalog.json'))

hosts = collections.defaultdict(list)
for g in cat:
    u = g.get('url') or ''
    if not u.startswith('http'):
        continue
    hosts[urlparse(u).netloc].append(u)

def probe(url):
    out = {'url': url}
    # GET with Range to keep it light
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Range': 'bytes=0-2047',
    })
    try:
        r = urllib.request.urlopen(req, timeout=14)
        h = r.headers
        out['status'] = r.status
        out['ct'] = (h.get('content-type') or '')[:40]
        out['xfo'] = h.get('x-frame-options') or ''
        out['csp'] = 'frame-ancestors' in (h.get('content-security-policy') or '').lower()
        out['acao'] = h.get('access-control-allow-origin') or ''
    except Exception as e:
        msg = str(e)[:60]
        code = getattr(e, 'code', None)
        out['status'] = code if code else 'ERR'
        out['err'] = msg
    return out

# one sample per host (max 2 for big hosts)
tasks = []
for h, urls in hosts.items():
    seen = set()
    for u in urls[:2]:
        if u not in seen:
            tasks.append(u)
            seen.add(u)

results = {}
with concurrent.futures.ThreadPoolExecutor(16) as ex:
    for out in ex.map(probe, tasks):
        host = urlparse(out['url']).netloc
        results[host] = out

print(f"{'HOST':45s} {'ST':>4s} {'XFO':>10s} {'CSP':>4s} {'ACAO':>2s}  content-type")
for host in sorted(results):
    r = results[host]
    print(f"{host:45s} {str(r.get('status'))[:4]:>4s} {r.get('xfo','')[:10]:>10s} {('Y' if r.get('csp') else '-'):>4s} {('Y' if r.get('acao') else '-'):>2s}  {r.get('ct', r.get('err',''))}")

json.dump(results, open('/tmp/host-probe.json', 'w'), indent=1)
print('\nsaved -> /tmp/host-probe.json')
