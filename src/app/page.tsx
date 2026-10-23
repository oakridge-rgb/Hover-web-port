"use client";

import { DailyCard } from "@/components/fate/daily-card";
import { CloudGames } from "@/components/fate/cloud-games";
import { Oracle } from "@/components/fate/oracle";
import { PwaBar } from "@/components/fate/pwa-bar";
import { PwaLab } from "@/components/fate/pwa-lab";
import { Threads } from "@/components/fate/threads";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePwa } from "@/hooks/use-pwa";
import { useFateStore } from "@/lib/store";
import { computeStreak, todayKey } from "@/lib/fate";
import { Eye, Flame, Gamepad2, HardDrive, MoonStar, Scale, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const VALID_TABS = new Set(["today", "oracle", "threads", "cloud", "lab"]);

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("today");
  const rolls = useFateStore((s) => s.rolls);
  const decisions = useFateStore((s) => s.decisions);
  const oracle = useFateStore((s) => s.oracle);
  const { isOnline } = usePwa();

  // Rehydrate the local-first store after mount (no SSR mismatch).
  useEffect(() => {
    useFateStore.persist.rehydrate();
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Deep links from manifest shortcuts: /?tab=oracle
  useEffect(() => {
    const id = window.setTimeout(() => {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && VALID_TABS.has(t)) setTab(t);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const today = mounted ? todayKey() : "";
  const todayRolled = today ? !!rolls[today] : false;
  const streak = mounted ? computeStreak(Object.keys(rolls)) : 0;
  const totalRolls = mounted ? Object.keys(rolls).length : 0;

  const stats = [
    { icon: Flame, label: "Streak", value: `${streak}${streak > 0 ? (streak === 1 ? " day" : " days") : ""}`, testid: "stat-streak" },
    { icon: MoonStar, label: "Fates drawn", value: String(totalRolls), testid: "stat-rolls" },
    { icon: Scale, label: "Threads", value: String(mounted ? decisions.length : 0), testid: "stat-threads" },
    { icon: Eye, label: "Whispers", value: String(mounted ? oracle.length : 0), testid: "stat-oracle" },
  ];

  return (
    <div className="mystic-bg flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/40 bg-stone-950">
              <Sparkles className="h-5 w-5 text-amber-400" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-lg leading-none text-amber-100">
                Fate <span className="text-amber-400">v6</span>
              </h1>
              <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">
                PWA edition · local-first
              </p>
            </div>
          </div>
          <PwaBar />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <section aria-label="Statistics" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value, testid }) => (
            <div
              key={label}
              data-testid={testid}
              className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-center"
            >
              <Icon className="mx-auto mb-1 h-4 w-4 text-amber-400" aria-hidden />
              <p className="font-display text-xl text-amber-100">{value || (label === "Streak" ? "0" : "0")}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        {mounted && !isOnline && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200"
            data-testid="offline-banner"
          >
            You are offline — and Fate v6 doesn&apos;t mind at all. Everything below still works.
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mx-auto mb-6 grid h-11 w-full max-w-md grid-cols-5 bg-card/60">
            <TabsTrigger value="today" className="gap-1 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300">
              <MoonStar className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Today</span>
            </TabsTrigger>
            <TabsTrigger value="oracle" className="gap-1 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300">
              <Eye className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Oracle</span>
            </TabsTrigger>
            <TabsTrigger value="threads" className="gap-1 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300">
              <Scale className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Threads</span>
            </TabsTrigger>
            <TabsTrigger value="cloud" className="gap-1 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300">
              <Gamepad2 className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Cloud</span>
            </TabsTrigger>
            <TabsTrigger value="lab" className="gap-1 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300">
              <HardDrive className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">PWA</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-0">
            {!mounted ? (
              <div className="mx-auto h-[420px] w-full max-w-md animate-pulse rounded-xl border border-border/60 bg-card/40" />
            ) : (
              <>
                <DailyCard />
                {todayRolled && (
                  <p className="mt-4 text-center text-xs text-muted-foreground" data-testid="already-rolled">
                    Today&apos;s fate is sealed. Return after midnight for a new thread.
                  </p>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="oracle" className="mt-0">
            <Oracle />
          </TabsContent>

          <TabsContent value="threads" className="mt-0">
            <Threads />
          </TabsContent>

          <TabsContent value="cloud" className="mt-0">
            <CloudGames />
          </TabsContent>

          <TabsContent value="lab" className="mt-0">
            <PwaLab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border/50 bg-background/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>Fate v6 · PWA edition — installable, offline-capable, local-first.</p>
          <p className="text-amber-400/70">Your data never leaves this device.</p>
        </div>
      </footer>
    </div>
  );
}
