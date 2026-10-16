"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useFateStore } from "@/lib/store";
import { dailyDraw, prettyDate, todayKey, type FateCard } from "@/lib/fate";
import { shareFateCard } from "@/lib/share-card";
import {
  CloudLightning, Compass, Crown, DoorOpen, Eye, Feather, Flame, Gem, Key,
  LoaderPinwheel, MoonStar, Scroll, Scale, Shell, Snowflake, Sparkles, Star,
  Anchor, Waypoints, Swords, Wheat, Share2, Clock, Hash, Quote, Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const CARD_ICONS: Record<string, LucideIcon> = {
  LoaderPinwheel, DoorOpen, Shell, Flame, CloudLightning, MoonStar, Scale,
  Crown, Key, Compass, Anchor, Feather, Gem, Snowflake, Swords, Wheat,
  Eye, Waypoints, Scroll, Star,
};

function CardGlyph({ card, className }: { card: FateCard; className?: string }) {
  const Icon = CARD_ICONS[card.icon] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}

export function DailyCard() {
  const { toast } = useToast();
  const rolls = useFateStore((s) => s.rolls);
  const rollToday = useFateStore((s) => s.rollToday);
  const setJournal = useFateStore((s) => s.setJournal);

  const [dateKey, setDateKey] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDateKey(todayKey()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const draw = useMemo(() => (dateKey ? dailyDraw(dateKey) : null), [dateKey]);
  const roll = dateKey ? rolls[dateKey] : undefined;
  const revealed = !!roll && !!draw;

  useEffect(() => {
    if (roll?.journal !== undefined) setDraft(roll.journal);
  }, [roll?.journal, roll?.date]);

  const onReveal = () => {
    if (!dateKey || !draw) return;
    setRevealing(true);
    setTimeout(() => {
      rollToday(dateKey, draw.card.id, draw.aspect);
      setRevealing(false);
    }, 620);
  };

  const onShare = async () => {
    if (!draw || !dateKey) return;
    setSharing(true);
    try {
      const result = await shareFateCard(draw, dateKey);
      toast({
        title: result === "shared" ? "Card shared" : "Card saved",
        description: result === "shared" ? "Off it goes." : "Check your downloads folder.",
      });
    } catch {
      toast({ title: "Could not create the card", description: "Try again in a moment." });
    } finally {
      setSharing(false);
    }
  };

  const saveJournal = () => {
    if (!dateKey) return;
    setJournal(dateKey, draft.trim());
    if (draft.trim()) toast({ title: "Journal kept", description: "Only this device will ever read it." });
  };

  if (!dateKey || !draw) {
    return <div className="h-[420px] rounded-xl border border-border/60 bg-card/40 animate-pulse" />;
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="mb-3 text-center text-sm text-muted-foreground">{prettyDate(dateKey)}</p>

      <div className="relative" style={{ perspective: "1200px" }}>
        <AnimatePresence mode="wait" initial={false}>
          {!revealed ? (
            <motion.div
              key="back"
              data-testid="card-back"
              className="relative mx-auto aspect-[3/5] w-full max-w-[300px] cursor-pointer select-none rounded-2xl border border-amber-500/30 bg-gradient-to-b from-stone-900 to-stone-950 shadow-[0_0_60px_-15px_rgba(245,184,74,0.35)]"
              initial={{ rotateY: 0, opacity: 0.9 }}
              animate={{ rotateY: revealing ? 360 : 0, opacity: 1 }}
              exit={{ rotateY: 90, opacity: 0, scale: 0.96 }}
              transition={{ duration: revealing ? 0.6 : 0.4, ease: "easeInOut" }}
              onClick={onReveal}
              role="button"
              aria-label="Reveal today's fate"
            >
              <div className="absolute inset-3 rounded-xl border border-amber-500/20" />
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <motion.div
                  animate={revealing ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: revealing ? 0.6 : 0.8, ease: revealing ? "easeInOut" : "linear", repeat: revealing ? 0 : Infinity }}
                >
                  <LoaderPinwheel className="h-16 w-16 text-amber-400" aria-hidden />
                </motion.div>
                <p className="font-display text-lg text-amber-200/90">Today&apos;s fate awaits</p>
                <p className="px-8 text-center text-xs text-muted-foreground">
                  One draw per day — the same card for everyone, everywhere, until midnight.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="front"
              data-testid="card-front"
              className="relative mx-auto w-full max-w-[300px] rounded-2xl border border-amber-500/40 bg-gradient-to-b from-stone-900 to-stone-950 p-6 shadow-[0_0_70px_-10px_rgba(245,184,74,0.4)]"
              initial={{ rotateY: -90, opacity: 0, scale: 0.96 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="absolute inset-2.5 rounded-xl border border-amber-500/15" />
              <div className="relative flex flex-col items-center gap-3 text-center">
                <CardGlyph card={draw.card} className="h-14 w-14 text-amber-400" />
                <h3 className="font-display text-2xl leading-tight text-amber-100">{draw.card.name}</h3>
                <p className="text-sm italic text-amber-400/90">{draw.aspect}</p>
                <Quote className="mt-1 h-4 w-4 text-amber-500/50" aria-hidden />
                <p className="text-sm text-stone-300">{draw.card.motto}</p>

                <div className="mt-2 w-full space-y-2 text-left text-xs">
                  <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-emerald-300/90">
                    <span className="font-semibold">Light:</span> {draw.card.light}
                  </p>
                  <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-rose-300/90">
                    <span className="font-semibold">Shadow:</span> {draw.card.shadow}
                  </p>
                </div>

                <div className="mt-1 flex w-full items-center justify-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{draw.window}</span>
                  <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" aria-hidden />{draw.number}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {revealed && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">
          <Button
            onClick={onShare}
            disabled={sharing}
            data-testid="share-button"
            className="w-full bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400"
          >
            <Share2 className="h-4 w-4" />
            {sharing ? "Weaving pixels…" : "Share this fate"}
          </Button>

          <div>
            <label htmlFor="journal" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Night journal — what did this card mean today? (stays on this device)
            </label>
            <Textarea
              id="journal"
              data-testid="journal-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveJournal}
              placeholder="Two lines is plenty…"
              rows={3}
              className="resize-none border-border/70 bg-card/60"
            />
          </div>
        </motion.div>
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
        <Sun className="mr-1 inline h-3 w-3" aria-hidden />
        Drawn from the date itself — no server, no seed leaks, works offline.
      </p>
    </div>
  );
}
