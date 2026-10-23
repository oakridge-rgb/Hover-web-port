"use client";

/**
 * Fate v6 — local-first store.
 * Everything lives in localStorage on the device. No server, no account,
 * no network required. This is what makes the app fully offline-capable.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Roll = {
  date: string; // YYYY-MM-DD
  cardId: string;
  aspect: string;
  journal?: string;
  createdAt: number;
};

export type Outcome = "good" | "bad" | "pending";

export type Decision = {
  id: string;
  text: string;
  weight: "light" | "heavy";
  outcome: Outcome;
  createdAt: number;
};

export type OracleEntry = {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
};

type FateState = {
  rolls: Record<string, Roll>;
  decisions: Decision[];
  oracle: OracleEntry[];
  rollToday: (date: string, cardId: string, aspect: string) => void;
  setJournal: (date: string, journal: string) => void;
  addDecision: (text: string, weight: Decision["weight"]) => void;
  setOutcome: (id: string, outcome: Outcome) => void;
  removeDecision: (id: string) => void;
  addOracle: (question: string, answer: string) => void;
  clearAll: () => void;
};

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useFateStore = create<FateState>()(
  persist(
    (set) => ({
      rolls: {},
      decisions: [],
      oracle: [],

      rollToday: (date, cardId, aspect) =>
        set((s) =>
          s.rolls[date]
            ? s // already revealed — the fates do not re-roll
            : { rolls: { ...s.rolls, [date]: { date, cardId, aspect, createdAt: Date.now() } } }
        ),

      setJournal: (date, journal) =>
        set((s) =>
          s.rolls[date]
            ? { rolls: { ...s.rolls, [date]: { ...s.rolls[date], journal } } }
            : s
        ),

      addDecision: (text, weight) =>
        set((s) => ({
          decisions: [
            { id: uid(), text, weight, outcome: "pending" as Outcome, createdAt: Date.now() },
            ...s.decisions,
          ].slice(0, 200),
        })),

      setOutcome: (id, outcome) =>
        set((s) => ({
          decisions: s.decisions.map((d) => (d.id === id ? { ...d, outcome } : d)),
        })),

      removeDecision: (id) =>
        set((s) => ({ decisions: s.decisions.filter((d) => d.id !== id) })),

      addOracle: (question, answer) =>
        set((s) => ({
          oracle: [{ id: uid(), question, answer, createdAt: Date.now() }, ...s.oracle].slice(
            0,
            100
          ),
        })),

      clearAll: () => set({ rolls: {}, decisions: [], oracle: [] }),
    }),
    {
      name: "fate-v6-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true, // rehydrated manually after mount → no SSR mismatch
    }
  )
);
