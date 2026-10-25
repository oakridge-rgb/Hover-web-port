"use client";

/**
 * Stratus cloud-gaming API client — with mirror rotation.
 *
 * Backend protocol (recovered from the opium portal client):
 *   GET  {base}/stratus/status              → { pool: { idle: number } }
 *   GET  {base}/stratus/games               → { games: [{ name, key, cover|image }] }
 *   POST {base}/stratus/session             { game_key } → { uuid, state, queue_pos }
 *   GET  {base}/stratus/session/{uuid}      → { state, queue_pos }
 *   POST {base}/stratus/session/{uuid}/start → { max_seconds, signaling_ws, ice_servers }
 *   POST {base}/stratus/session/{uuid}/quit
 *
 * The live portal keeps a list of mirror domains and health-pings them,
 * picking the first responsive one. Mirrors die regularly (they are front
 * domains behind Cloudflare), so hardcoding one breaks the whole feature —
 * we replicate the rotation here: probe all mirrors in parallel, prefer the
 * fastest one that answers, remember it, and re-rotate on failure.
 *
 * If direct browser calls are blocked (CORS/network), each mirror can also
 * be reached through the same-origin proxy at /api/stratus/*.
 */

/** Mirror list in the same order the portal's loader uses. */
export const STRATUS_MIRRORS = [
  "cdn.northstreetumc.org",
  "cdn.vipersfutbol.com",
  "cdn.pcesc.org",
  "cdn.kcchallengevbc.com",
  "cdn.slcbmooc.org",
  "cdn.topstargym.net",
  "cdn.goaplytexas.org",
  "cdn.clearfieldswimming.com",
  "cdn.richardacademy.cfd",
] as const;

export const DEFAULT_STRATUS_HOST: string = STRATUS_MIRRORS[0];

export type StratusMode = "direct" | "proxy";

export type CloudGame = {
  name: string;
  key: string;
  cover: string | null;
};

export type StratusStatus = {
  pool?: { idle?: number; total?: number };
};

export type SessionStart = {
  max_seconds: number;
  signaling_ws: string;
  ice_servers: RTCIceServer[];
};

export type SessionInfo = {
  uuid: string;
  state: string;
  queue_pos?: number;
  max_seconds?: number;
};

export type MirrorState = {
  host: string;
  /** /stratus/status answered with valid JSON */
  ok: boolean;
  /** alive at the edge but served a Cloudflare bot-check page */
  challenge: boolean;
  ms: number | null;
  via: StratusMode | null;
  error?: string;
};

const LS_GAMES_KEY = "fate-v6-cloud-games";
const LS_HOST_KEY = "fate-v6-stratus-host"; // manual override
const LS_AUTO_KEY = "fate-v6-stratus-auto-host"; // last auto-picked mirror
const LS_MODE_KEY = "fate-v6-stratus-mode"; // "auto" | "manual"
const GAMES_TTL_MS = 10 * 60 * 1000;

const PROBE_DIRECT_MS = 6000;
const PROBE_PROXY_MS = 12000;
const ROTATE_THROTTLE_MS = 45 * 1000;

let lastMirrorStates: MirrorState[] = [];
let lastRotateAt = 0;
let rotating: Promise<{ picked: string | null; results: MirrorState[] }> | null = null;

// ---------------- host selection ----------------

export function isAutoMode(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return (localStorage.getItem(LS_MODE_KEY) || "auto") !== "manual";
  } catch {
    return true;
  }
}

export function getStratusHost(): string {
  if (typeof window === "undefined") return DEFAULT_STRATUS_HOST;
  try {
    if (!isAutoMode()) {
      const manual = localStorage.getItem(LS_HOST_KEY);
      if (manual) return manual;
    }
    return localStorage.getItem(LS_AUTO_KEY) || DEFAULT_STRATUS_HOST;
  } catch {
    return DEFAULT_STRATUS_HOST;
  }
}

/** Manual override: pin a specific host (mirror or custom). */
export function setStratusHost(host: string) {
  try {
    const clean = host.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 200);
    localStorage.setItem(LS_MODE_KEY, "manual");
    if (clean) localStorage.setItem(LS_HOST_KEY, clean);
    else localStorage.removeItem(LS_HOST_KEY);
  } catch {
    /* private mode — ignore */
  }
}

/** Back to automatic mirror rotation. */
export function setAutoMode() {
  try {
    localStorage.setItem(LS_MODE_KEY, "auto");
  } catch {
    /* ignore */
  }
}

export function getMirrorStates(): MirrorState[] {
  return lastMirrorStates;
}

// ---------------- health probing ----------------

function classify(res: Response): "ok" | "challenge" | "dead" {
  if (res.ok) return "ok";
  return "challenge";
}

async function probeDirectOnce(host: string, timeoutMs: number): Promise<MirrorState> {
  const t0 = performance.now();
  try {
    const res = await fetch(`https://${host}/stratus/status`, {
      method: "GET",
      credentials: "include",
      signal: AbortSignal.timeout?.(timeoutMs),
    });
    const ms = Math.round(performance.now() - t0);
    const verdict = classify(res);
    if (verdict === "ok") {
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (json && !json.error) return { host, ok: true, challenge: false, ms, via: "direct" };
      return { host, ok: false, challenge: false, ms, via: "direct", error: (json?.error as string) || `HTTP ${res.status}` };
    }
    const text = (await res.text().catch(() => "")).slice(0, 400);
    const challenge = /just a moment|challenge-platform|__cf_chl|cf-browser-verification|attention required/i.test(text) || res.status === 403 || res.status === 503;
    return {
      host,
      ok: false,
      challenge,
      ms,
      via: "direct",
      error: challenge ? "bot-checked (Cloudflare)" : `HTTP ${res.status}`,
    };
  } catch (e) {
    return { host, ok: false, challenge: false, ms: null, via: null, error: (e as Error)?.name === "TimeoutError" ? "timed out" : "unreachable" };
  }
}

/** The backend flaps per-request (one call hangs, the next succeeds seconds
 *  later) — always give a mirror a second chance before declaring it dead. */
async function probeDirect(host: string): Promise<MirrorState> {
  const first = await probeDirectOnce(host, PROBE_DIRECT_MS);
  if (first.ok) return first;
  await new Promise((r) => setTimeout(r, 500));
  const second = await probeDirectOnce(host, PROBE_DIRECT_MS);
  if (second.ok) return second;
  return first.ms !== null ? first : second; // prefer whichever actually reached the edge
}

async function probeProxy(host: string): Promise<MirrorState> {
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/stratus/status?host=${encodeURIComponent(host)}`, {
      method: "GET",
      signal: AbortSignal.timeout?.(PROBE_PROXY_MS),
    });
    const ms = Math.round(performance.now() - t0);
    const text = await res.text().catch(() => "");
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(text) as Record<string, unknown>; } catch { /* HTML challenge etc. */ }
    if (res.ok && json && !json.error) return { host, ok: true, challenge: false, ms, via: "proxy" };
    // the proxy can read what the page cannot — a CF bot-check means the mirror is alive
    const challenge = /just a moment|challenge-platform|__cf_chl|attention required/i.test(text) || res.status === 403 || res.status === 503;
    return {
      host,
      ok: false,
      challenge,
      ms,
      via: "proxy",
      error: challenge ? "bot-checked (Cloudflare)" : (json?.error as string) || `HTTP ${res.status}`,
    };
  } catch (e) {
    return { host, ok: false, challenge: false, ms: null, via: null, error: (e as Error)?.name === "TimeoutError" ? "proxy timed out" : "proxy unreachable" };
  }
}

/** Probe every mirror (direct, then via proxy when direct fails) in parallel. */
export async function probeAllMirrors(): Promise<MirrorState[]> {
  const direct = await Promise.all(STRATUS_MIRRORS.map((h) => probeDirect(h)));
  const results = await Promise.all(
    direct.map(async (d) => {
      if (d.ok) return d;
      const viaProxy = await probeProxy(d.host);
      if (viaProxy.ok) return viaProxy;
      // proxy reached a CF bot-check → mirror is alive, just gated for this network
      if (viaProxy.challenge) {
        return { host: d.host, ok: false, challenge: true, ms: viaProxy.ms, via: null, error: "bot-checked (Cloudflare)" };
      }
      return d; // keep the direct diagnosis if proxy also failed
    })
  );
  lastMirrorStates = results;
  return results;
}

function pickBest(results: MirrorState[]): string | null {
  const ok = results.filter((r) => r.ok && r.ms !== null).sort((a, b) => (a.ms as number) - (b.ms as number));
  if (ok.length) return ok[0].host;
  const challenged = results.filter((r) => r.challenge && r.ms !== null).sort((a, b) => (a.ms as number) - (b.ms as number));
  if (challenged.length) return challenged[0].host;
  return null;
}

/**
 * Rotate to the healthiest mirror (throttled). Persists the pick and
 * invalidates the games cache when the host changes.
 */
export async function autoSelectMirror(force = false): Promise<{ picked: string | null; results: MirrorState[] }> {
  if (rotating) return rotating;
  if (!force && Date.now() - lastRotateAt < ROTATE_THROTTLE_MS) {
    return { picked: getStratusHost(), results: lastMirrorStates };
  }
  rotating = (async () => {
    const results = await probeAllMirrors();
    const picked = pickBest(results);
    lastRotateAt = Date.now();
    if (picked) {
      const prev = getStratusHost();
      if (picked !== prev) {
        try {
          localStorage.setItem(LS_AUTO_KEY, picked);
          localStorage.removeItem(LS_GAMES_KEY);
        } catch {
          /* ignore */
        }
      }
    }
    return { picked, results };
  })();
  try {
    return await rotating;
  } finally {
    rotating = null;
  }
}

// ---------------- REST client ----------------

export function stratusHttpBase(mode: StratusMode, hostOverride?: string): string {
  const host = hostOverride || getStratusHost();
  return mode === "proxy" ? "/api/stratus" : `https://${host}/stratus`;
}

/** WS signaling endpoint: wss://<host>/stratus/signal/<id> */
export function buildSignalingUrl(signalingWs: string, hostOverride?: string): string {
  const id = signalingWs.split("/").pop() || "";
  const host = hostOverride || getStratusHost();
  return `wss://${host}/stratus/signal/${id}`;
}

type ApiResult<T> = T & { error?: string };

const TIMEOUT_DIRECT_MS = 6500;
const TIMEOUT_PROXY_MS = 22000;

/** Transient failures are worth retrying — the backend flaps per-request. */
const TRANSIENT_RE = /timed out|network error/i;

async function apiOnce<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  mode: StratusMode = "direct",
  hostOverride?: string
): Promise<ApiResult<T>> {
  const host = hostOverride || getStratusHost();
  const url =
    mode === "proxy"
      ? `/api/stratus/${path}?host=${encodeURIComponent(host)}`
      : `https://${host}/stratus/${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    // the proxy needs longer: its upstream call runs server-side with its own retries
    signal: AbortSignal.timeout?.(mode === "proxy" ? TIMEOUT_PROXY_MS : TIMEOUT_DIRECT_MS),
  }).catch((e) => {
    throw new Error(e?.name === "TimeoutError" ? "backend timed out" : `network error (${e?.message || "blocked"})`);
  });
  const data = (await res.json().catch(() => ({}))) as ApiResult<T>;
  if (!res.ok && !data.error) data.error = `HTTP ${res.status}`;
  return data;
}

/**
 * One REST call, retried against transient hangs. The backend currently
 * flaps per-request (one call blackholes, the very next one answers), so a
 * single-shot fetch is a coin flip. JSON-level errors ("does not exist",
 * "HTTP 403") are definitive and return immediately.
 */
async function api<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  mode: StratusMode = "direct",
  hostOverride?: string
): Promise<ApiResult<T>> {
  // POST retries once: a hung POST may still have landed server-side, so
  // more than one replay risks duplicate sessions. GETs can try three times.
  const maxTries = method === "GET" ? 3 : 2;
  let lastMsg = "backend unreachable";
  for (let attempt = 0; attempt < maxTries; attempt++) {
    try {
      return await apiOnce<T>(path, method, body, mode, hostOverride);
    } catch (e) {
      lastMsg = (e as Error)?.message || lastMsg;
      if (!TRANSIENT_RE.test(lastMsg)) throw e;
      if (attempt < maxTries - 1) await new Promise((r) => setTimeout(r, attempt === 0 ? 700 : 2000));
    }
  }
  throw new Error(lastMsg);
}

type FallbackOpts = {
  /** pin the host (session flow — a session only exists on the backend that created it) */
  host?: string;
  /** skip direct entirely / force a mode for every attempt */
  fixedMode?: StratusMode;
};

/**
 * REST call with layered fallback:
 *   direct → (auto mode: rotate mirror, retry direct) → same-origin proxy.
 * Never throws.
 */
async function apiWithFallback<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  opts: FallbackOpts = {}
): Promise<{ data: ApiResult<T>; mode: StratusMode }> {
  const fixed = opts.fixedMode;
  if (fixed) {
    try {
      return { data: await api<T>(path, method, body, fixed, opts.host), mode: fixed };
    } catch {
      const other: StratusMode = fixed === "direct" ? "proxy" : "direct";
      try {
        return { data: await api<T>(path, method, body, other, opts.host), mode: other };
      } catch (e2) {
        return { data: { error: (e2 as Error)?.message || "backend unreachable" } as ApiResult<T>, mode: other };
      }
    }
  }

  try {
    return { data: await api<T>(path, method, body, "direct", opts.host), mode: "direct" };
  } catch {
    // mirror may have died — rotate once (auto mode only) and retry direct
    if (isAutoMode()) {
      await autoSelectMirror();
      try {
        return { data: await api<T>(path, method, body, "direct"), mode: "direct" };
      } catch {
        /* fall through to proxy */
      }
    }
    try {
      return { data: await api<T>(path, method, body, "proxy"), mode: "proxy" };
    } catch (e2) {
      return { data: { error: (e2 as Error)?.message || "backend unreachable" } as ApiResult<T>, mode: "proxy" };
    }
  }
}

export async function fetchStatus(): Promise<{ status?: StratusStatus; error?: string; mode: StratusMode }> {
  const { data, mode } = await apiWithFallback<StratusStatus>("status", "GET");
  return { status: data.error ? undefined : data, error: data.error, mode };
}

/** Catalog with localStorage cache (10 min, host-stamped). */
export async function fetchCloudGames(): Promise<{ games: CloudGame[]; error?: string; mode: StratusMode }> {
  try {
    const raw = localStorage.getItem(LS_GAMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { t: number; host?: string; games: CloudGame[] };
      const fresh = Array.isArray(parsed.games) && Date.now() - parsed.t < GAMES_TTL_MS;
      // a cache stamped by another mirror is useless: covers + session affinity are per-host
      if (fresh && (!parsed.host || parsed.host === getStratusHost())) {
        return { games: parsed.games, mode: "direct" };
      }
    }
  } catch {
    /* cache miss */
  }

  const { data, mode } = await apiWithFallback<{ games?: Array<{ name: string; key: string; cover?: string; image?: string }> }>("games", "GET");
  if (data.error) return { games: [], error: data.error, mode };

  const games: CloudGame[] = (data.games || []).map((g) => ({
    name: g.name,
    key: g.key,
    cover: g.cover || g.image || null,
  }));

  try {
    localStorage.setItem(LS_GAMES_KEY, JSON.stringify({ t: Date.now(), host: getStratusHost(), games }));
  } catch {
    /* ignore */
  }
  return { games, mode };
}

export function coverUrl(game: CloudGame): string | null {
  if (!game.cover) return null;
  if (/^https?:\/\//.test(game.cover)) return game.cover;
  const host = getStratusHost();
  return game.cover.startsWith("/") ? `https://${host}${game.cover}` : `https://${host}/${game.cover}`;
}

export type StratusSessionApi = {
  createSession: (gameKey: string) => Promise<ApiResult<SessionInfo> & { mode: StratusMode }>;
  pollSession: (uuid: string) => Promise<ApiResult<SessionInfo> & { mode: StratusMode }>;
  startSession: (uuid: string) => Promise<ApiResult<SessionStart> & { mode: StratusMode }>;
  quitSession: (uuid: string) => void;
  /** host this session was created on — signaling must ride the same mirror */
  getHost: () => string;
};

export function makeSessionApi(): StratusSessionApi {
  let lastMode: StratusMode = "direct";
  let sessionHost = getStratusHost();
  const withMode = <T,>(r: ApiResult<T>): ApiResult<T> & { mode: StratusMode } => ({ ...r, mode: lastMode });

  return {
    createSession: async (gameKey) => {
      sessionHost = getStratusHost();
      const { data, mode } = await apiWithFallback<SessionInfo>("session", "POST", { game_key: gameKey });
      lastMode = mode;
      if (!data.error) sessionHost = getStratusHost();
      return withMode(data);
    },
    pollSession: async (uuid) => {
      const { data, mode } = await apiWithFallback<SessionInfo>(`session/${uuid}`, "GET", undefined, {
        host: sessionHost,
      });
      lastMode = mode;
      return withMode(data);
    },
    startSession: async (uuid) => {
      const { data, mode } = await apiWithFallback<SessionStart>(`session/${uuid}/start`, "POST", {}, {
        host: sessionHost,
      });
      lastMode = mode;
      return withMode(data);
    },
    quitSession: (uuid) => {
      // keepalive so the quit fires even while the page is unloading
      try {
        const base = stratusHttpBase(lastMode, sessionHost);
        fetch(`${base}/session/${uuid}/quit`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    },
    getHost: () => sessionHost,
  };
}
