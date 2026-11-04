#!/usr/bin/env python3
"""Stage-2 validation: verify wisp endpoints actually proxy HTTP traffic.

Flow per endpoint:
  1. connect WS, expect mandatory hello CONTINUE (type 3, stream 0)
  2. send CONNECT (type 1) for TCP info.cern.ch:80
  3. send DATA (type 2) with a raw HTTP request
  4. expect DATA (type 2) back containing "HTTP/1."
Prints pass/fail per endpoint.
"""
import asyncio
import json
import ssl
import sys
import time

import websockets

SEM = asyncio.Semaphore(30)
ssl_ctx = ssl.create_default_context()

HTTP_REQ = b"GET / HTTP/1.0\r\nHost: info.cern.ch\r\nUser-Agent: curl/8.5\r\n\r\n"


def frame(ptype, sid, payload=b""):
    return bytes([ptype]) + sid.to_bytes(4, "little") + payload


def connect_frame(sid, host, port, stype=0x01):
    return frame(0x01, sid, bytes([stype]) + port.to_bytes(2, "little") + host.encode())


async def probe(url):
    t0 = time.perf_counter()
    try:
        async with SEM:
            async with websockets.connect(
                url, ssl=ssl_ctx if url.startswith("wss:") else None,
                open_timeout=8, close_timeout=2, max_size=1 << 22,
                additional_headers={"User-Agent": "Mozilla/5.0", "Origin": "https://example.com"},
            ) as ws:
                # 1. mandatory hello
                hello = await asyncio.wait_for(ws.recv(), timeout=6)
                if not (isinstance(hello, (bytes, bytearray)) and len(hello) >= 5 and hello[0] == 3
                        and int.from_bytes(hello[1:5], "little") == 0):
                    return {"url": url, "ok": False, "err": f"bad hello {bytes(hello[:6]).hex() if isinstance(hello,(bytes,bytearray)) else hello!r}"}
                # 2+3. CONNECT + HTTP request as DATA
                await ws.send(connect_frame(1, "info.cern.ch", 80))
                await ws.send(frame(0x02, 1, HTTP_REQ))
                data = b""
                cont = False
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline and b"HTTP/" not in data:
                    try:
                        m = await asyncio.wait_for(ws.recv(), timeout=max(0.2, deadline - time.monotonic()))
                    except (asyncio.TimeoutError, websockets.ConnectionClosed):
                        break
                    if isinstance(m, (bytes, bytearray)) and len(m) >= 5:
                        ptype, sid = m[0], int.from_bytes(m[1:5], "little")
                        if ptype == 3 and sid == 1:
                            cont = True
                        elif ptype == 2 and sid == 1:
                            data += m[5:]
                        elif ptype == 4 and sid == 1:
                            return {"url": url, "ok": False, "err": f"CLOSE reason={m[5:6].hex()}"}
                        elif ptype == 4 and sid == 0:
                            return {"url": url, "ok": False, "err": f"CLOSE(0) reason={m[5:6].hex()}"}
                ms = int((time.perf_counter() - t0) * 1000)
                ok = b"HTTP/" in data
                head = data[:46].decode("utf-8", "replace").replace("\r", "").replace("\n", " ")
                return {"url": url, "ok": ok, "ms": ms, "cont": cont, "http": head if ok else data[:30].hex()}
    except Exception as e:
        return {"url": url, "ok": False, "err": type(e).__name__ + ": " + str(e)[:90]}


async def main():
    urls = [l.strip() for l in open(sys.argv[1]) if l.strip()]
    print(f"stage-2 testing {len(urls)} endpoints", file=sys.stderr)
    res = await asyncio.gather(*[probe(u) for u in urls])
    ok = [r for r in res if r["ok"]]
    ok.sort(key=lambda r: r["ms"])
    json.dump(res, open(sys.argv[2] if len(sys.argv) > 2 else "stage2.json", "w"), indent=1)
    print(f"PROXY-VERIFIED {len(ok)} / {len(res)}")
    for r in ok:
        print(f"  {r['ms']:>6}ms cont={int(r['cont'])} {r['url']}  | {r['http']}")
    print("--- failures ---")
    for r in res:
        if not r["ok"]:
            print(f"  {r['url']}  {r.get('err', 'no http data')}")


if __name__ == "__main__":
    asyncio.run(main())
