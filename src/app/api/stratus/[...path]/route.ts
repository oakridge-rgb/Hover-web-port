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

const DEFAULT_HOST = "cdn.vipersfutbol.com";

function cleanHost(raw: string | null): string {
  return (raw || DEFAULT_HOST).replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 200);
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const host = cleanHost(url.searchParams.get("host"));
  url.searchParams.delete("host");

  const target = `https://${host}/stratus/${(path || []).join("/")}${url.search}`;

  const fwdHeaders = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) fwdHeaders.set("content-type", ct);
  const accept = req.headers.get("accept");
  if (accept) fwdHeaders.set("accept", accept);
  const cookie = req.headers.get("cookie");
  if (cookie) fwdHeaders.set("cookie", cookie);
  // a browser-ish UA — the CDN filters plain bot clients
  fwdHeaders.set(
    "user-agent",
    req.headers.get("user-agent") ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: fwdHeaders,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch (e) {
    const msg = (e as Error)?.name === "TimeoutError" ? "backend timed out" : "backend unreachable";
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
