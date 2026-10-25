import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin proxy for the Stratus cloud-gaming REST API.
 *
 * Used as a fallback when the browser cannot reach the CDN directly
 * (CORS / network filtering). Forwards method, body and cookies, and
 * relays Set-Cookie back onto this origin so the session affinity
 * cookie the backend issues keeps working through the proxy.
 *
 *   /api/stratus/status?host=cdn.vipersfutbol.com
 *   /api/stratus/session?host=…        (POST { game_key })
 *   /api/stratus/session/{uuid}/start
 */

const DEFAULT_HOST = "cdn.northstreetumc.org";

// block SSRF-style hosts — the proxy should only ever reach public stratus mirrors
const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

function cleanHost(raw: string | null): string {
  const h = (raw || DEFAULT_HOST).replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 200);
  if (!/^[\w.-]+$/.test(h) || PRIVATE_HOST.test(h)) return "";
  return h;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const host = cleanHost(url.searchParams.get("host"));
  url.searchParams.delete("host");
  if (!host) return NextResponse.json({ error: "bad host" }, { status: 400 });

  const target = `https://${host}/stratus/${(path || []).join("/")}${url.search}`;

  const fwdHeaders = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) fwdHeaders.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) fwdHeaders.set("accept", accept);
  const cookie = req.headers.get("cookie");
  if (cookie) fwdHeaders.set("cookie", cookie);
  // Full browser-grade header set — the CDN blackholes plain bot clients
  // (requests without sec-* headers hang instead of answering).
  fwdHeaders.set(
    "user-agent",
    req.headers.get("user-agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
  fwdHeaders.set("sec-ch-ua", '"Not/A)Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"');
  fwdHeaders.set("sec-ch-ua-mobile", "?0");
  fwdHeaders.set("sec-ch-ua-platform", '"Windows"');
  fwdHeaders.set("sec-fetch-dest", "empty");
  fwdHeaders.set("sec-fetch-mode", "cors");
  fwdHeaders.set("sec-fetch-site", "cross-site");
  fwdHeaders.set("accept-language", "en-US,en;q=0.9");

  // The stratus backend flaps per-request (one call blackholes, the next
  // answers) — retry transient upstream failures before giving up.
  const reqBody = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const attempts = 2;
  const ATTEMPT_MS = 9000;
  let upstream: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers: fwdHeaders,
        body: reqBody,
        signal: AbortSignal.timeout(ATTEMPT_MS),
        cache: "no-store",
      });
      // a hung edge can also answer 5xx — retry those too
      if (upstream.status >= 500 && attempt < attempts - 1) {
        const clone = upstream.clone();
        await clone.text().catch(() => "");
        lastErr = new Error(`upstream HTTP ${upstream.status}`);
        upstream = null;
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (!upstream) {
    const msg =
      (lastErr as Error)?.name === "TimeoutError" || String(lastErr).includes("timeout")
        ? "backend timed out"
        : "backend unreachable";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const body = await upstream.text();
  const res = new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });

  // relay session cookies onto this origin
  try {
    const setCookies = upstream.headers.getSetCookie?.() || [];
    for (const sc of setCookies) res.headers.append("set-cookie", sc);
  } catch { /* no cookies */ }

  return res;
}

export const GET = proxy;
export const POST = proxy;
export const dynamic = "force-dynamic";
