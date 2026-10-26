"use client";

/**
 * KeyDrift — a Nitro-Type-style typing racer built into Fate v6.
 *
 * Why it exists: nitrotype.com sends `X-Frame-Options: SAMEORIGIN`, so no
 * browser will ever render it inside another site, and school filters block
 * the domain itself. KeyDrift lives on our own origin — nothing to embed,
 * nothing to block, works offline. Best WPM / races / wins persist locally
 * in the Fate v6 store (localStorage), like everything else in this PWA.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crosshair,
  ExternalLink,
  Flag,
  Gauge,
  Play,
  RotateCcw,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { useFateStore } from "@/lib/store";

const RACE_WORDS = 30;

const WORDS = [
  "the","and","for","are","but","not","you","all","any","can","had","her","was","one","our","out",
  "day","get","has","him","his","how","man","new","now","old","see","two","way","who","boy","did",
  "its","let","put","say","she","too","use","that","with","have","this","will","your","from","they",
  "know","want","been","good","much","some","time","very","when","come","here","just","like","long",
  "make","many","more","only","over","such","take","than","them","well","were","what","about","after",
  "again","below","could","every","first","found","great","house","large","learn","never","other",
  "place","point","right","small","sound","spell","still","study","their","there","these","thing",
  "think","three","water","where","which","world","would","write","years","above","along","always",
  "around","because","before","begin","being","between","both","came","child","city","close","country",
  "does","earth","even","example","face","family","father","feel","food","form","four","girl","give",
  "going","hand","hard","head","hear","help","high","home","into","kind","land","last","leave","life",
  "light","line","little","live","look","made","means","mile","miss","most","mother","mountain","move",
  "must","name","near","need","next","night","number","often","once","open","page","paper","part",
  "people","play","read","same","school","sea","second","seem","show","side","something","start",
  "state","stop","story","sure","tell","then","thought","through","together","took","tree","try",
  "turn","under","until","walk","watch","while","white","word","work","year","young","car","speed",
  "race","fast","track","engine","wheel","road","drive","turbo","shift","gear","drift","spark","blaze",
  "comet","vega","torque","nitro","boost","type","quick","best","win","finish","flag","lane","zone",
];

type Phase = "idle" | "countdown" | "racing" | "done";
type Results = { wpm: number; acc: number; secs: number; placement: number; pb: boolean };

type Opponent = {
  name: string;
  body: string;
  dark: string;
  wpm: number;
  rng: () => number;
  progress: number;
  finished: boolean;
};

const DIFFICULTIES = {
  cruise: { label: "Cruise", desc: "Rivals type 26-40 WPM", min: 26, max: 40 },
  sport: { label: "Sport", desc: "Rivals type 42-58 WPM", min: 42, max: 58 },
  nitro: { label: "Nitro", desc: "Rivals type 60-80 WPM", min: 60, max: 80 },
} as const;
type Difficulty = keyof typeof DIFFICULTIES;

const RIVALS = [
  { name: "Torque", body: "#a8a29e", dark: "#57534e" },
  { name: "Vega", body: "#34d399", dark: "#065f46" },
  { name: "Comet", body: "#fb7185", dark: "#9f1239" },
];

const PLACE = ["1st place", "2nd place", "3rd place", "4th place"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWords(n: number): string[] {
  const out: string[] = [];
  const used = new Set<number>();
  while (out.length < n) {
    const i = Math.floor(Math.random() * WORDS.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(WORDS[i]);
  }
  return out;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  body: string,
  dark: string,
  burst: boolean,
  now: number
) {
  const cw = 46;
  const ch = 20;
  const y = cy - ch / 2;
  ctx.fillStyle = "#0c0a09";
  rr(ctx, x + 5, y - 3, 9, 5, 2); ctx.fill();
  rr(ctx, x + 5, y + ch - 2, 9, 5, 2); ctx.fill();
  rr(ctx, x + cw - 15, y - 3, 9, 5, 2); ctx.fill();
  rr(ctx, x + cw - 15, y + ch - 2, 9, 5, 2); ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + ch);
  g.addColorStop(0, body);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  rr(ctx, x, y, cw, ch, 7); ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(x + 1, y + 3, 3, ch - 6);
  ctx.fillStyle = "rgba(12,10,9,0.8)";
  rr(ctx, x + 15, y + 4, 15, ch - 8, 3); ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(x + cw - 4, y + 4, 3, 3);
  ctx.fillRect(x + cw - 4, y + ch - 7, 3, 3);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(x, y + 4, 2, 3);
  ctx.fillRect(x, y + ch - 7, 2, 3);
  if (burst) {
    const f = Math.floor(now / 60) % 2;
    ctx.fillStyle = f ? "#f59e0b" : "#f97316";
    ctx.beginPath();
    ctx.moveTo(x - 1, cy - 5);
    ctx.lineTo(x - 12 - f * 6, cy);
    ctx.lineTo(x - 1, cy + 5);
    ctx.closePath();
    ctx.fill();
  }
}

type RaceHud = {
  wpm: number;
  acc: number;
  nitro: number;
  burst: boolean;
  secs: number;
};

type RaceState = {
  correctChars: number;
  typedTotal: number;
  typedCorrect: number;
  startAt: number;
  nitro: number;
  burstUntil: number;
  dashOffset: number;
  playerProgress: number;
  bonusProgress: number;
  totalChars: number;
  opponents: Opponent[];
};

type TickerOpts = {
  state: RaceState;
  /** when `v` flips to false the ticker stops re-queuing itself */
  alive: { v: boolean };
  onFrame: (now: number) => void;
  onHud: (hud: RaceHud) => void;
};

/**
 * Frame loop for an active race, built at module level on purpose: it mutates
 * plain race state every frame and re-queues itself with rAF, which React
 * Compiler's lint forbids inside hook callbacks. `alive.v = false` ends it.
 */
function makeTicker(opts: TickerOpts): (now: number) => void {
  let last = 0;
  let hudAt = 0;
  function tick(now: number) {
    if (!opts.alive.v) return;
    const st = opts.state;
    let dt = last ? (now - last) / 1000 : 0;
    last = now;
    dt = Math.min(Math.max(dt, 0), 0.06);

    for (const o of st.opponents) {
      if (o.finished) continue;
      const base = (o.wpm * 5) / 60;
      const noise = 0.8 + o.rng() * 0.4;
      const gap = st.playerProgress - o.progress;
      const rubber = gap > 0.28 ? 0.85 : gap < -0.5 ? 1.05 : 1;
      o.progress += (base * noise * rubber * dt) / st.totalChars;
      if (o.progress >= 1) {
        o.progress = 1;
        o.finished = true;
      }
    }

    const bursting = now < st.burstUntil;
    if (bursting) st.nitro = Math.max(0, ((st.burstUntil - now) / 2600) * 100);
    st.dashOffset += (bursting ? 560 : 170) * dt;

    opts.onFrame(now);

    if (now - hudAt > 120) {
      hudAt = now;
      const mins = Math.max(0.008, (now - st.startAt) / 60000);
      opts.onHud({
        wpm: Math.round(st.correctChars / 5 / mins),
        acc: st.typedTotal > 0 ? Math.round((100 * st.typedCorrect) / st.typedTotal) : 100,
        nitro: Math.round(st.nitro),
        burst: bursting,
        secs: (now - st.startAt) / 1000,
      });
    }
    requestAnimationFrame(tick);
  }
  return tick;
}

export function Racer() {
  const racerBest = useFateStore((s) => s.racerBest);
  const racerRaces = useFateStore((s) => s.racerRaces);
  const racerWins = useFateStore((s) => s.racerWins);

  const [phase, setPhase] = useState<Phase>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("sport");
  const [words, setWords] = useState<string[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [count, setCount] = useState(3);
  const [goFlash, setGoFlash] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [hud, setHud] = useState({ wpm: 0, acc: 100, nitro: 0, burst: false, secs: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const aliveRef = useRef({ v: false });
  const timersRef = useRef<number[]>([]);
  const flashRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const gameRef = useRef({
    correctChars: 0,
    typedTotal: 0,
    typedCorrect: 0,
    startAt: 0,
    nitro: 0,
    burstUntil: 0,
    dashOffset: 0,
    playerProgress: 0,
    bonusProgress: 0,
    totalChars: 1,
    opponents: [] as Opponent[],
  });

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const drawScene = useCallback(
    (now: number) => {
      const cv = canvasRef.current;
      const { w, h, dpr } = sizeRef.current;
      if (!cv || w === 0) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const lanes = 4;
      const laneH = h / lanes;
      const st = gameRef.current;
      const burst = st.startAt > 0 && now < st.burstUntil;

      ctx.fillStyle = "#171310";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(245,184,74,0.05)";
      ctx.fillRect(0, laneH * 3, w, laneH);

      // Scrolling lane dashes — the road moves as you type.
      ctx.strokeStyle = "rgba(245,184,74,0.16)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 16]);
      ctx.lineDashOffset = -st.dashOffset;
      for (let i = 1; i < lanes; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * laneH);
        ctx.lineTo(w, i * laneH);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Start line.
      const startX = 14;
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.moveTo(startX, 2);
      ctx.lineTo(startX, h - 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Checkered finish.
      const fx = w - 40;
      for (let row = 0; row < lanes * 2; row++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = (row + c) % 2 ? "rgba(245,184,74,0.55)" : "rgba(20,18,16,0.95)";
          ctx.fillRect(fx + c * 8, row * (laneH / 2), 8, laneH / 2);
        }
      }

      // Curbs.
      ctx.fillStyle = "rgba(245,184,74,0.35)";
      ctx.fillRect(0, 0, w, 3);
      ctx.fillRect(0, h - 3, w, 3);

      const usable = fx - startX - 46 - 6;
      const laneCy = (i: number) => i * laneH + laneH / 2;
      st.opponents.forEach((o, i) => {
        drawCar(ctx, startX + 8 + o.progress * usable, laneCy(i), o.body, o.dark, false, now);
      });
      drawCar(
        ctx,
        startX + 8 + Math.min(1, st.playerProgress) * usable,
        laneCy(3),
        "#f5b84a",
        "#b45309",
        burst,
        now
      );
    },
    []
  );

  // Keep the canvas backing store matched to its CSS box (DPR aware).
  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      sizeRef.current = { w, h, dpr };
      drawScene(performance.now());
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [drawScene]);

  // Keep the active word centered in the typing viewport.
  useEffect(() => {
    const box = textRef.current;
    if (!box) return;
    const el = box.querySelector<HTMLElement>('[data-current="true"]');
    if (el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
  }, [wordIndex]);

  // Cancel every timer + frame on unmount.
  useEffect(() => {
    return () => {
      aliveRef.current.v = false;
      clearTimers();
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(flashRef.current);
    };
  }, [clearTimers]);

  const finishPlayer = useCallback(() => {
    const st = gameRef.current;
    const now = performance.now();
    const mins = Math.max(0.008, (now - st.startAt) / 60000);
    const wpm = Math.round(st.correctChars / 5 / mins);
    const acc = st.typedTotal > 0 ? Math.round((100 * st.typedCorrect) / st.typedTotal) : 100;
    const secs = Math.round((now - st.startAt) / 100) / 10;
    const placement = Math.min(4, 1 + st.opponents.filter((o) => o.finished).length);
    const prev = useFateStore.getState().racerBest;
    const pb = !prev || wpm > prev.wpm;
    useFateStore.getState().recordRace(wpm, acc, placement === 1);
    setResults({ wpm, acc, secs, placement, pb });
    setPhase("done");
    st.playerProgress = 1;
    aliveRef.current.v = false;
    cancelAnimationFrame(rafRef.current);
    window.setTimeout(() => drawScene(performance.now()), 0);
  }, [drawScene]);

  const startRace = useCallback(
    (diff: Difficulty) => {
      clearTimers();
      cancelAnimationFrame(rafRef.current);
      const ws = pickWords(RACE_WORDS);
      const total = ws.reduce((n, w) => n + w.length, 0) + ws.length;
      const conf = DIFFICULTIES[diff];
      const st = gameRef.current;
      st.correctChars = 0;
      st.typedTotal = 0;
      st.typedCorrect = 0;
      st.nitro = 0;
      st.burstUntil = 0;
      st.dashOffset = 0;
      st.playerProgress = 0;
      st.bonusProgress = 0;
      st.totalChars = total;
      st.startAt = 0;
      st.opponents = RIVALS.map((r, i) => {
        const rng = mulberry32((Date.now() ^ (i * 0x9e3779b9)) >>> 0);
        return { ...r, wpm: conf.min + rng() * (conf.max - conf.min), rng, progress: 0, finished: false };
      });
      setWords(ws);
      setWordIndex(0);
      setTyped("");
      setResults(null);
      setHud({ wpm: 0, acc: 100, nitro: 0, burst: false, secs: 0 });
      setPhase("countdown");
      setCount(3);
      timersRef.current.push(window.setTimeout(() => setCount(2), 700));
      timersRef.current.push(window.setTimeout(() => setCount(1), 1400));
      timersRef.current.push(
        window.setTimeout(() => {
          setGoFlash(true);
          timersRef.current.push(window.setTimeout(() => setGoFlash(false), 600));
          setPhase("racing");
          st.startAt = performance.now();
          aliveRef.current = { v: true };
          const ticker = makeTicker({ state: st, alive: aliveRef.current, onFrame: drawScene, onHud: setHud });
          rafRef.current = requestAnimationFrame(ticker);
          inputRef.current?.focus();
        }, 2100)
      );
      window.setTimeout(() => drawScene(performance.now()), 0);
    },
    [clearTimers, drawScene]
  );

  const quitRace = useCallback(() => {
    aliveRef.current.v = false;
    clearTimers();
    cancelAnimationFrame(rafRef.current);
    setPhase("idle");
    setWords([]);
    setWordIndex(0);
    setTyped("");
    setResults(null);
    window.setTimeout(() => drawScene(performance.now()), 0);
  }, [clearTimers, drawScene]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = words[wordIndex];
    if (!target || phase !== "racing") return;
    const v = e.target.value.slice(0, target.length);
    if (v.length > typed.length) {
      const st = gameRef.current;
      st.typedTotal += v.length - typed.length;
      if (target[v.length - 1] === v[v.length - 1]) st.typedCorrect += 1;
    }
    setTyped(v);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") e.preventDefault();
    if (phase !== "racing") return;
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    const t = typed.trim();
    if (!t) return;
    const target = words[wordIndex];
    if (!target) return;
    const st = gameRef.current;
    if (t === target) {
      st.correctChars += target.length + 1;
      const now = performance.now();
      if (now < st.burstUntil) {
        st.bonusProgress += 0.02;
      } else {
        st.nitro = Math.min(100, st.nitro + 9);
        if (st.nitro >= 100) st.burstUntil = now + 2600;
      }
      st.playerProgress = Math.min(1, (st.correctChars + st.bonusProgress) / st.totalChars);
      if (wordIndex + 1 >= words.length) {
        finishPlayer();
        return;
      }
      setWordIndex(wordIndex + 1);
      setTyped("");
    } else {
      setWrongFlash(true);
      window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setWrongFlash(false), 350);
      st.nitro = Math.max(0, st.nitro - 8);
    }
  };

  const mins = Math.floor(hud.secs / 60);
  const secsLabel = `${mins}:${String(Math.floor(hud.secs % 60)).padStart(2, "0")}`;

  return (
    <div className="space-y-4" data-testid="racer-root">
      {phase === "idle" ? (
        <>
          <div className="rounded-xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/40 bg-stone-950">
                <Flag className="h-5 w-5 text-amber-400" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl text-amber-100">KeyDrift</h2>
                <p className="text-xs text-muted-foreground">
                  Typing racer · built into Fate v6 · unblockable &amp; offline
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-stone-300">
              Race three rivals by typing the highlighted words. Every correct word pushes
              your car down the strip and charges your nitro — fill the bar and you get a
              burst of pure speed. Wrong words kill momentum, so stay smooth.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-border/60 bg-stone-950/50 px-3 py-2">
                <p className="font-display text-lg text-amber-300" data-testid="racer-best-wpm">
                  {racerBest ? racerBest.wpm : "--"}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Best WPM</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-stone-950/50 px-3 py-2">
                <p className="font-display text-lg text-amber-300">{racerRaces}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Races</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-stone-950/50 px-3 py-2">
                <p className="font-display text-lg text-amber-300">{racerWins}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Wins</p>
              </div>
            </div>

            <p className="mt-5 mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Pick your league
            </p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Difficulty">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  data-testid={`racer-diff-${d}`}
                  aria-pressed={difficulty === d}
                  className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                    difficulty === d
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                      : "border-border/60 bg-stone-950/40 text-stone-300 hover:border-amber-500/30"
                  }`}
                >
                  <span className="block font-display text-sm">{DIFFICULTIES[d].label}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                    {DIFFICULTIES[d].desc}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => startRace(difficulty)}
              data-testid="racer-start"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 font-semibold text-stone-950 transition-colors hover:bg-amber-400"
            >
              <Play className="h-4 w-4" aria-hidden />
              Start engine
            </button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
              <ExternalLink className="h-4 w-4 text-amber-400" aria-hidden />
              About the real Nitro Type
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              nitrotype.com sends an <span className="text-stone-300">X-Frame-Options: SAMEORIGIN</span>{" "}
              header — an instruction that forbids every browser from rendering it inside any
              other website, so no embed or iframe can ever work, and school filters usually
              block the domain itself. That is why KeyDrift is built right here: same
              nitro-fueled typing vibe, zero blocks, works offline. When you are off the
              school network, the original is one click away.
            </p>
            <a
              href="https://www.nitrotype.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="racer-nitrotype-link"
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-amber-500/40 px-3 text-sm text-amber-300 transition-colors hover:bg-amber-500/10"
            >
              <Flag className="h-4 w-4" aria-hidden />
              Open nitrotype.com
            </a>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-2.5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5" aria-label="Words per minute">
                <Gauge className="h-4 w-4 text-amber-400" aria-hidden />
                <span className="font-display text-lg text-amber-200" data-testid="racer-hud-wpm">
                  {hud.wpm}
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">wpm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Crosshair className="h-4 w-4 text-amber-400" aria-hidden />
                <span className="font-display text-lg text-amber-200">{hud.acc}%</span>
                <span className="text-[10px] uppercase text-muted-foreground">acc</span>
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <Timer className="h-4 w-4 text-amber-400" aria-hidden />
                <span className="font-display text-lg text-amber-200">{secsLabel}</span>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 sm:max-w-[180px]">
              <Zap
                className={`h-4 w-4 ${hud.burst ? "animate-pulse text-amber-300" : "text-amber-400"}`}
                aria-hidden
              />
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${
                    hud.burst ? "bg-amber-300" : "bg-amber-500"
                  }`}
                  style={{ width: `${hud.nitro}%` }}
                  data-testid="racer-nitro"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={quitRace}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-amber-300"
              aria-label="Quit race"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div
            ref={wrapRef}
            className="relative h-56 w-full overflow-hidden rounded-xl border border-border/60 sm:h-60"
            onClick={() => inputRef.current?.focus()}
          >
            <canvas ref={canvasRef} className="block h-full w-full" data-testid="racer-canvas" />
            {phase === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-950/50">
                <span className="font-display text-6xl text-amber-400" data-testid="racer-count">
                  {count}
                </span>
              </div>
            )}
            {goFlash && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="font-display text-6xl text-amber-300">GO</span>
              </div>
            )}
          </div>

          {phase !== "done" ? (
            <>
              <div
                ref={textRef}
                className="relative h-28 overflow-hidden rounded-xl border border-border/60 bg-stone-950/60 p-3 font-mono text-sm leading-7"
                data-testid="racer-words"
              >
                {words.map((w, wi) => (
                  <span
                    key={wi}
                    ref={wi === wordIndex ? undefined : undefined}
                    data-current={wi === wordIndex ? "true" : undefined}
                    className="whitespace-nowrap"
                  >
                    {w.split("").map((ch, ci) => {
                      let cls = "text-stone-600";
                      if (wi === wordIndex) {
                        cls =
                          ci < typed.length
                            ? typed[ci] === ch
                              ? "text-emerald-400"
                              : "text-red-400 underline"
                            : "text-amber-100/90";
                      } else if (wi < wordIndex) {
                        cls = "text-stone-600";
                      }
                      return (
                        <span key={ci} className={cls}>
                          {ch}
                        </span>
                      );
                    })}
                    {wi < words.length - 1 ? " " : ""}
                  </span>
                ))}
              </div>
              <input
                ref={inputRef}
                value={typed}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                onPaste={(e) => e.preventDefault()}
                disabled={phase !== "racing"}
                maxLength={words[wordIndex]?.length}
                placeholder={phase === "racing" ? "Type the highlighted word, then space…" : "Get ready…"}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Typing input"
                data-testid="racer-input"
                className={`h-12 w-full rounded-xl border bg-stone-950/60 px-4 font-mono text-base text-amber-100 outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-amber-500/60 ${
                  wrongFlash ? "border-red-500/70" : "border-border/60"
                }`}
              />
              <p className="text-center text-[11px] text-muted-foreground">
                Word {Math.min(wordIndex + 1, words.length)} of {words.length} · wrong words
                bounce off, correct ones charge nitro
              </p>
            </>
          ) : (
            results && (
              <div
                className="rounded-xl border border-amber-500/40 bg-card/60 p-6 text-center"
                role="status"
                data-testid="racer-results"
              >
                <Trophy
                  className={`mx-auto h-8 w-8 ${results.placement === 1 ? "text-amber-400" : "text-stone-500"}`}
                  aria-hidden
                />
                <h3 className="mt-2 font-display text-2xl text-amber-100">
                  {PLACE[results.placement - 1]}
                </h3>
                {results.pb && (
                  <p className="mt-1 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs text-amber-300">
                    New personal best
                  </p>
                )}
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-border/60 bg-stone-950/50 px-3 py-2">
                    <p className="font-display text-lg text-amber-300" data-testid="racer-result-wpm">
                      {results.wpm}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">WPM</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-stone-950/50 px-3 py-2">
                    <p className="font-display text-lg text-amber-300">{results.acc}%</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Accuracy</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-stone-950/50 px-3 py-2">
                    <p className="font-display text-lg text-amber-300">{results.secs}s</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startRace(difficulty)}
                    data-testid="racer-again"
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 font-semibold text-stone-950 transition-colors hover:bg-amber-400"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Race again
                  </button>
                  <button
                    type="button"
                    onClick={quitRace}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-border/60 text-stone-300 transition-colors hover:border-amber-500/40 hover:text-amber-300"
                  >
                    <Flag className="h-4 w-4" aria-hidden />
                    Garage
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
