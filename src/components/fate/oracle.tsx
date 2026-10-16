"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFateStore } from "@/lib/store";
import { oracleAnswer } from "@/lib/fate";
import { Eye, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export function Oracle() {
  const oracle = useFateStore((s) => s.oracle);
  const addOracle = useFateStore((s) => s.addOracle);
  const [question, setQuestion] = useState("");
  const [latest, setLatest] = useState<{ q: string; a: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    setThinking(true);
    setLatest(null);
    setTimeout(() => {
      const a = oracleAnswer(q);
      addOracle(q, a);
      setLatest({ q, a });
      setThinking(false);
      setQuestion("");
    }, 900);
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="text-center">
        <Eye className="mx-auto mb-2 h-8 w-8 text-amber-400" aria-hidden />
        <h2 className="font-display text-xl text-amber-100">The Oracle</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask plainly. The answer is deterministic per hour — the same question gets the same
          answer until the hour turns.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Should I send the message?"
          aria-label="Your question for the Oracle"
          maxLength={140}
          className="border-border/70 bg-card/60"
          data-testid="oracle-input"
        />
        <Button
          type="submit"
          disabled={!question.trim() || thinking}
          data-testid="oracle-ask"
          className="bg-amber-500 font-semibold text-stone-950 hover:bg-amber-400"
        >
          Ask
        </Button>
      </form>

      <div aria-live="polite">
        <AnimatePresence mode="wait">
          {thinking && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-amber-500/25 bg-card/50 p-5 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                className="mx-auto"
              >
                <Sparkles className="h-6 w-6 text-amber-400" aria-hidden />
              </motion.div>
              <p className="mt-2 text-sm italic text-muted-foreground">The veils are parting…</p>
            </motion.div>
          )}
          {!thinking && latest && (
            <motion.div
              key={latest.a}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              data-testid="oracle-answer"
              className="rounded-xl border border-amber-500/30 bg-card/60 p-5 text-center"
            >
              <p className="mb-2 truncate text-xs text-muted-foreground">“{latest.q}”</p>
              <p className="font-display text-lg leading-relaxed text-amber-100">{latest.a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {oracle.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Past whispers
          </h3>
          <ScrollArea className="max-h-60 rounded-xl border border-border/60 bg-card/30">
            <ul className="divide-y divide-border/40 p-0">
              {oracle.slice(0, 20).map((entry) => (
                <li key={entry.id} className="px-4 py-3 text-sm">
                  <p className="truncate text-muted-foreground">{entry.question}</p>
                  <p className="text-amber-200/90">{entry.answer}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
