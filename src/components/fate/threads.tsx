"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFateStore, type Outcome } from "@/lib/store";
import { Check, CheckCircle2, HelpCircle, Scale, Trash2, TrendingUp, X } from "lucide-react";
import { useState } from "react";

const OUTCOME_META: Record<Outcome, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  pending: { label: "Unwritten", icon: HelpCircle, cls: "text-muted-foreground border-border/60" },
  good: { label: "It served me", icon: CheckCircle2, cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  bad: { label: "It cost me", icon: X, cls: "text-rose-400 border-rose-500/30 bg-rose-500/5" },
};

export function Threads() {
  const decisions = useFateStore((s) => s.decisions);
  const addDecision = useFateStore((s) => s.addDecision);
  const setOutcome = useFateStore((s) => s.setOutcome);
  const removeDecision = useFateStore((s) => s.removeDecision);
  const [text, setText] = useState("");
  const [weight, setWeight] = useState<"light" | "heavy">("light");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    addDecision(t, weight);
    setText("");
  };

  const resolved = decisions.filter((d) => d.outcome !== "pending").length;
  const served = decisions.filter((d) => d.outcome === "good").length;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="text-center">
        <Scale className="mx-auto mb-2 h-8 w-8 text-amber-400" aria-hidden />
        <h2 className="font-display text-xl text-amber-100">Threads of Decision</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Log the crossroads, come back later, mark how it turned. A private ledger of your
          judgment — stored only on this device.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Today I chose to…"
          aria-label="Decision to log"
          maxLength={160}
          className="border-border/70 bg-card/60"
          data-testid="thread-input"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWeight(weight === "light" ? "heavy" : "light")}
            className={`h-9 shrink-0 border-border/70 ${weight === "heavy" ? "border-amber-500/60 text-amber-300" : "text-muted-foreground"}`}
            aria-label={`Weight: ${weight}. Click to toggle.`}
          >
            {weight === "light" ? "Light thread" : "Heavy thread"}
          </Button>
          <Button
            onClick={submit}
            disabled={!text.trim()}
            data-testid="thread-add"
            className="h-9 flex-1 bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400 sm:flex-none"
          >
            Weave it
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden /> {decisions.length} woven
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5" aria-hidden /> {resolved} resolved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {served} served you
        </span>
      </div>

      {decisions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No threads yet. The first decision you log will wait for you here — even with the
          network off.
        </div>
      ) : (
        <ScrollArea className="max-h-[420px] rounded-xl border border-border/60 bg-card/30">
          <ul className="divide-y divide-border/40" data-testid="thread-list">
            {decisions.map((d) => {
              const meta = OUTCOME_META[d.outcome];
              const Icon = meta.icon;
              return (
                <li key={d.id} className="group px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-stone-200" title={d.text}>
                        {d.text}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}
                        >
                          <Icon className="h-3 w-3" aria-hidden /> {meta.label}
                        </span>
                        <span
                          className={`text-[11px] ${d.weight === "heavy" ? "text-amber-400" : "text-muted-foreground/70"}`}
                        >
                          {d.weight === "heavy" ? "heavy thread" : "light thread"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                        aria-label="Mark as it served me"
                        onClick={() => setOutcome(d.id, d.outcome === "good" ? "pending" : "good")}
                      >
                        <Check aria-hidden className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label="Mark as it cost me"
                        onClick={() => setOutcome(d.id, d.outcome === "bad" ? "pending" : "bad")}
                      >
                        <X aria-hidden className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-stone-300"
                        aria-label="Cut this thread"
                        onClick={() => removeDecision(d.id)}
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
