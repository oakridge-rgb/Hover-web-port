"use client";

/**
 * Stratus cloud-gaming API client.
 *
 * Backend protocol (recovered from the opium portal client):
 *   GET  {base}/stratus/status              → { pool: { idle: number } }
 *   GET  {base}/stratus/games               → { games: [{ name, key, cover|image }] }
 *   POST {base}/stratus/session             { game_key } → { uuid, state, queue_pos }
 *   GET  {base}/stratus/session/{uuid}      → { state, queue_pos }
 *   POST {base}/stratus/session/{uuid}/start → { max_seconds, signaling_ws, ice_servers }
 *   POST {base}/stratus/session/{uuid}/quit
 *
 * The default host is the same CDN the portal uses (cdn.vipersfutbol.com).
 * If direct browser calls are blocked (CORS/network), REST falls back to the
 * same-origin proxy at /api/stratus/*.
 */

export const DEFAULT_STRATUS_HOST = "cdn.vipersfutbol.com";

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

const LS_GAMES_KEY = "fate-v6-cloud-games";
const LS_HOST_KEY = "fate-v6-stratus-host";
const GAMES_TTL_MS = 10 * 60 * 1000;

export function getStratusHost(): string {
  if (typeof window === "undefined") return DEFAULT_STRATUS_HOST;
  try {
    return localStorage.getItem(LS_HOST_KEY) || DEFAULT_STRATUS_HOST;
  } catch {
    return DEFAULT_STRATUS_HOST;
  }
}

export function setStratusHost(host: string) {
  try {
    const clean = host.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (clean) localStorage.setItem(LS_HOST_KEY, clean);
    else localStorage.removeItem(LS_HOST_KEY);
  } catch {
    /* private mode — ignore */
  }
}

export function stratusHttpBase(mode: StratusMode): string {
  return mode === "proxy" ? "/api/stratus" : `https://${getStratusHost()}/stratus`;
}

/** WS signaling endpoint: wss://<host>/stratus/signal/<id> */
export function buildSignalingUrl(signalingWs: string): string {
  const id = signalingWs.split("/").pop() || "";
  const host = getStratusHost();
  return `wss://${host}/stratus/signal/${id}`;
}

type ApiResult<T> = T & { error?: string };

const TIMEOUT_DIRECT_MS = 9000;
const TIMEOUT_PROXY_MS = 25000;

async function api<T>(path: string, method: "GET" | "POST", body?: unknown, mode: StratusMode = "direct"): Promise<ApiResult<T>> {
  const url =
    mode === "proxy"
      ? `/api/stratus/${path}?host=${encodeURIComponent(getStratusHost())}`
      : `https://${getStratusHost()}/stratus/${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    // the proxy needs longer: its upstream call runs server-side for up to 20s
    signal: AbortSignal.timeout?.(mode === "proxy" ? TIMEOUT_PROXY_MS : TIMEOUT_DIRECT_MS),
  }).catch((e) => {
    throw new Error(e?.name === "TimeoutError" ? "backend timed out" : `network error (${e?.message || "blocked"})`);
  });
  const data = (await res.json().catch(() => ({}))) as ApiResult<T>;
  if (!res.ok && !data.error) data.error = `HTTP ${res.status}`;
  return data;
}

/** REST call: try direct, fall back to the same-origin proxy. Never throws. */
async function apiWithFallback<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<{ data: ApiResult<T>; mode: StratusMode }> {
  try {
    return { data: await api<T>(path, method, body, "direct"), mode: "direct" };
  } catch {
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

/** Catalog with localStorage cache (10 min) — same idea as the portal client. */
export async function fetchCloudGames(): Promise<{ games: CloudGame[]; error?: string; mode: StratusMode }> {
  try {
    const raw = localStorage.getItem(LS_GAMES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { t: number; games: CloudGame[] };
      if (Array.isArray(parsed.games) && Date.now() - parsed.t < GAMES_TTL_MS) {
        return { games: parsed.games };
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
    localStorage.setItem(LS_GAMES_KEY, JSON.stringify({ t: Date.now(), games }));
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
};

export function makeSessionApi(): StratusSessionApi {
  let lastMode: StratusMode = "direct";
  const withMode = <T,>(r: ApiResult<T>): ApiResult<T> & { mode: StratusMode } => ({ ...r, mode: lastMode });

  return {
    createSession: async (gameKey) => {
      const { data, mode } = await apiWithFallback<SessionInfo>("session", "POST", { game_key: gameKey });
      lastMode = mode;
      return withMode(data);
    },
    pollSession: async (uuid) => {
      try {
        const data = await api<SessionInfo>(`session/${uuid}`, "GET", undefined, lastMode);
        return withMode(data);
      } catch (e) {
        return { error: (e as Error).message, mode: lastMode } as ApiResult<SessionInfo> & { mode: StratusMode };
      }
    },
    startSession: async (uuid) => {
      const { data, mode } = await apiWithFallback<SessionStart>(`session/${uuid}/start`, "POST", {});
      lastMode = mode;
      return withMode(data);
    },
    quitSession: (uuid) => {
      // keepalive so the quit fires even while the page is unloading
      try {
        const base = stratusHttpBase(lastMode);
        fetch(`${base}/session/${uuid}/quit`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    },
  };
}
