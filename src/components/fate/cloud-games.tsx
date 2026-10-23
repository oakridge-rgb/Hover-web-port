"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  coverUrl, fetchCloudGames, fetchStatus, getStratusHost, setStratusHost,
  DEFAULT_STRATUS_HOST, type CloudGame,
} from "@/lib/stratus";
import { CloudPlayer, type CloudPhase } from "@/lib/cloud-player";
import {
  Cloud, CloudCog, Gamepad2, Loader2, Maximize, MonitorPlay, Play, RefreshCw, Wifi, X, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Status = { state: "checking" | "ok" | "error"; idle?: number; mode?: string; error?: string };

export function CloudGames() {
  const { toast } = useToast();

  const [status, setStatus] = useState<Status>({ state: "checking" });
  const [host, setHost] = useState(DEFAULT_STRATUS_HOST);
  const [hostDraft, setHostDraft] = useState(DEFAULT_STRATUS_HOST);
  const [games, setGames] = useState<CloudGame[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // player state
  const playerRef = useRef<CloudPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const relockRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<CloudGame | null>(null);
  const [phase, setPhase] = useState<CloudPhase>("idle");
  const [phaseDetail, setPhaseDetail] = useState("");
  const [phaseBusy, setPhaseBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setGamesError(null);
    try {
      // status + catalog probe in parallel — worst case ≈ direct timeout + proxy timeout
      const [s, g] = await Promise.all([fetchStatus(), fetchCloudGames()]);
      if (s.error) setStatus({ state: "error", error: s.error, mode: s.mode });
      else setStatus({ state: "ok", idle: s.status?.pool?.idle, mode: s.mode });
      if (g.error) setGamesError(g.error);
      setGames(g.games);
    } catch (e) {
      setStatus({ state: "error", error: (e as Error)?.message || "probe failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setHost(getStratusHost());
      setHostDraft(getStratusHost());
      refresh();
    }, 0);
    return () => {
      window.clearTimeout(id);
      playerRef.current?.quit();
    };
  }, [refresh]);

  const applyHost = () => {
    setStratusHost(hostDraft);
    setHost(getStratusHost());
    try { localStorage.removeItem("fate-v6-cloud-games"); } catch { /* ignore */ }
    playerRef.current?.quit();
    setPlayerOpen(false);
    refresh();
    toast({ title: "Backend updated", description: `Stratus host → ${getStratusHost()}` });
  };

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.name.toLowerCase().includes(q));
  }, [games, filter]);

  const startGame = async (game: CloudGame) => {
    if (playerRef.current?.isBusy) return;
    playerRef.current?.quit();
    setActiveGame(game);
    setPlayerOpen(true);
    setPhase("requesting");
    setPhaseDetail("contacting backend…");
    setPhaseBusy(true);
    setTimeLeft(null);
    setConfirmQuit(false);

    const player = new CloudPlayer({
      onPhase: (p, detail, busy) => {
        setPhase(p);
        setPhaseDetail(detail);
        setPhaseBusy(busy);
      },
      onStreamReady: () => { /* video element already bound via srcObject */ },
      onConnected: () => setConfirmQuit(false),
      onEnded: (title, detail) => {
        setPhase("ended");
        setPhaseDetail(detail ? `${title} — ${detail}` : title);
        setPhaseBusy(false);
      },
      onTimeLeft: (s) => setTimeLeft(s),
    });
    playerRef.current = player;

    // wait a tick so the video element exists, then bind + launch
    setTimeout(() => {
      if (videoRef.current && relockRef.current && overlayRef.current) {
        player.bindUi(videoRef.current, relockRef.current, overlayRef.current);
      }
      player.start(game.key).catch(() => {});
    }, 50);
  };

  const quitGame = () => {
    if (!confirmQuit) {
      setConfirmQuit(true);
      setTimeout(() => setConfirmQuit(false), 5000);
      return;
    }
    playerRef.current?.quit();
    playerRef.current = null;
    setPlayerOpen(false);
    setPhase("idle");
  };

  const timeLabel = useMemo(() => {
    if (timeLeft === null) return "";
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [timeLeft]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="text-center">
        <Cloud className="mx-auto mb-2 h-8 w-8 text-amber-400" aria-hidden />
        <h2 className="font-display text-xl text-amber-100">Cloud Gaming</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full PC games streamed from the Stratus cloud CDN over WebRTC — the same backend the
          opium portal uses. Keyboard, mouse and pointer-lock input are piped straight into the
          instance.
        </p>
      </div>

      {/* backend status */}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-3">
        <div className="flex items-center gap-3">
          {status.state === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" aria-hidden />
          ) : status.state === "ok" ? (
            <Wifi className="h-4 w-4 text-emerald-400" aria-hidden />
          ) : (
            <XCircle className="h-4 w-4 text-rose-400" aria-hidden />
          )}
          <div className="text-xs">
            <p className="font-medium text-stone-200">{host}</p>
            <p className="text-muted-foreground">
              {status.state === "ok" &&
                `${status.idle ?? "?"} idle instance${(status.idle ?? 0) === 1 ? "" : "s"} · ${status.mode === "proxy" ? "via proxy" : "direct"}`}
              {status.state === "error" && `unreachable — ${status.error}`}
              {status.state === "checking" && "checking backend…"}
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Refresh" onClick={refresh}>
          <RefreshCw className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {/* host override */}
      <div className="flex gap-2">
        <Input
          value={hostDraft}
          onChange={(e) => setHostDraft(e.target.value)}
          placeholder="stratus host (e.g. cdn.vipersfutbol.com)"
          aria-label="Stratus backend host"
          className="border-border/70 bg-card/60 font-mono text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={applyHost}
          className="h-9 shrink-0 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
        >
          <CloudCog className="h-4 w-4" aria-hidden />
          Set
        </Button>
      </div>

      {/* catalog */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Gamepad2 className="h-3.5 w-3.5" aria-hidden /> Catalog ({filtered.length})
          </h3>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter games…"
            aria-label="Filter cloud games"
            className="h-8 w-40 border-border/70 bg-card/60 text-xs"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl border border-border/50 bg-card/40" />
            ))}
          </div>
        ) : gamesError && !games.length ? (
          <div className="rounded-xl border border-dashed border-rose-500/30 p-6 text-center text-sm text-rose-300/80">
            {gamesError}
            <p className="mt-2 text-xs text-muted-foreground">
              The CDN only accepts real browser traffic from residential networks — try the Set
              field above if the host rotated.
            </p>
          </div>
        ) : !filtered.length ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No games match.
          </div>
        ) : (
          <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3" data-testid="cloud-grid">
            {filtered.map((g) => (
              <button
                key={g.key}
                onClick={() => startGame(g)}
                data-testid={`cloud-game-${g.key}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-amber-500/5"
              >
                <div className="relative aspect-video w-full bg-stone-900">
                  {coverUrl(g) ? (
                    <img
                      src={coverUrl(g) as string}
                      alt={g.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <MonitorPlay className="h-8 w-8 text-stone-700" aria-hidden />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="h-8 w-8 fill-amber-400 text-amber-400" aria-hidden />
                  </span>
                </div>
                <span className="truncate px-2.5 py-2 text-xs text-stone-300 group-hover:text-amber-200">{g.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- player overlay ---------------- */}
      {playerOpen && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-stone-950" data-testid="cloud-player">
          <div className="flex items-center gap-2 border-b border-border/60 bg-stone-900 px-3 py-2">
            <MonitorPlay className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm text-stone-300" data-testid="cloud-player-title">
              cloud/{activeGame?.name ?? ""}
            </span>
            {timeLeft !== null && timeLeft > 0 && (
              <span className="shrink-0 font-mono text-xs text-amber-300/90" data-testid="cloud-time-left">{timeLabel}</span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-stone-400"
              aria-label="Toggle fullscreen"
              onClick={() => shellRef.current && playerRef.current?.fullscreen(shellRef.current)}
            >
              <Maximize className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={quitGame}
              data-testid="cloud-quit"
              className={`h-8 shrink-0 ${confirmQuit ? "animate-pulse border-rose-500/60 text-rose-300" : "border-border/60 text-stone-400"}`}
            >
              <X className="h-4 w-4" aria-hidden />
              {confirmQuit ? "Sure?" : "Quit"}
            </Button>
          </div>

          <div ref={shellRef} className="relative flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full bg-black object-contain"
              data-testid="cloud-video"
            />

            {/* phase / ended overlay */}
            <div
              ref={overlayRef}
              className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 ${phase === "streaming" ? "hidden" : ""}`}
              data-testid="cloud-overlay"
            >
              {phaseBusy && <Loader2 className="h-7 w-7 animate-spin text-amber-400" aria-hidden />}
              <p className="font-display text-lg text-amber-100" data-testid="cloud-phase">{phase}</p>
              <p className="max-w-[80%] text-center text-sm text-muted-foreground" data-testid="cloud-phase-detail">{phaseDetail}</p>
              {phase === "error" && (
                <Button size="sm" variant="outline" className="mt-2 border-amber-500/50 text-amber-300" onClick={() => activeGame && startGame(activeGame)}>
                  Retry
                </Button>
              )}
              {phase === "ended" && (
                <Button size="sm" variant="outline" className="mt-2 border-border/60 text-stone-300" onClick={quitGame}>
                  Close
                </Button>
              )}
            </div>

            {/* pointer-lock relock hint */}
            <div
              ref={relockRef}
              className="relock-hint absolute inset-0 z-20 cursor-pointer items-center justify-center bg-black/35 text-sm font-medium text-white"
              data-testid="cloud-relock"
            >
              click to recapture input
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
