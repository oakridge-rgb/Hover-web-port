#!/usr/bin/env python3
"""Probe wisp endpoints with a real wisp v1 CONNECT handshake.

Reads candidate URLs (one per line, wss://host/path) from a file,
connects to each in parallel, sends a wisp CONNECT for TCP example.com:80,
and records whether ANY valid wisp frame (DATA=1 / CONTINUE=2 / CLOSE=3)
comes back. Outputs JSON results.
"""
import asyncio
import json
import ssl
import sys
import time
from urllib.parse import urlparse

import websockets

SEM = asyncio.Semaphore(40)
PER_ENDPOINT_TIMEOUT = 12.0
CONNECT_TIMEOUT = 8.0

ssl_ctx = ssl.create_default_context()


def wisp_connect_frame(stream_id=1, host="example.com", port=80):
    b = bytearray()
    b += stream_id.to_bytes(4, "little")      # stream id
    b += b"\x00"                              # packet type: CONNECT
    b += b"\x01"                              # stream type: TCP
    b += len(host.encode()).to_bytes(1, "big")  # host length
    b += host.encode()                        # host
    b += port.to_bytes(2, "big")              # port (BE)
    return bytes(b)


async def probe_one(url):
    t0 = time.perf_counter()
    try:
        async with SEM:
            async with websockets.connect(
                url,
                ssl=ssl_ctx if url.startswith("wss:") else None,
                open_timeout=CONNECT_TIMEOUT,
                close_timeout=2,
                max_size=1 << 20,
                additional_headers={"User-Agent": "Mozilla/5.0", "Origin": "https://example.com"},
            ) as ws:
                await ws.send(wisp_connect_frame())
                # wait for any binary frame, classify it
                deadline = time.monotonic() + (PER_ENDPOINT_TIMEOUT - (time.perf_counter() - t0))
                while time.monotonic() < deadline:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=max(0.2, deadline - time.monotonic()))
                    except asyncio.TimeoutError:
                        break
                    except websockets.ConnectionClosed:
                        break
                    if isinstance(msg, (bytes, bytearray)):
                        if len(msg) >= 5:
                            ptype = msg[0]
                            if ptype in (1, 2, 3):  # DATA / CONTINUE / CLOSE
                                return {"url": url, "ok": True, "ms": int((time.perf_counter() - t0) * 1000), "frame": ptype}
                            return {"url": url, "ok": False, "err": f"bad frame type {ptype}"}
        return {"url": url, "ok": False, "err": "timeout/no wisp frame"}
    except Exception as e:
        return {"url": url, "ok": False, "err": type(e).__name__ + ": " + str(e)[:120]}


async def main():
    infile = sys.argv[1] if len(sys.argv) > 1 else "candidates.txt"
    outfile = sys.argv[2] if len(sys.argv) > 2 else "probe_results.json"
    urls = []
    seen = set()
    for line in open(infile):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if not line.startswith("wss://"):
            line = "wss://" + line
        if line not in seen:
            seen.add(line)
            urls.append(line)
    print(f"probing {len(urls)} endpoints ...", file=sys.stderr)
    results = await asyncio.gather(*[probe_one(u) for u in urls])
    ok = [r for r in results if r["ok"]]
    bad = [r for r in results if not r["ok"]]
    ok.sort(key=lambda r: r["ms"])
    json.dump({"alive": ok, "dead": bad}, open(outfile, "w"), indent=1)
    print(f"ALIVE {len(ok)} / {len(results)}")
    for r in ok[:40]:
        print(f"  {r['ms']:>6}ms  frame{r['frame']}  {r['url']}")


if __name__ == "__main__":
    asyncio.run(main())
