/**
 * Fate v6 — deterministic fate engine.
 * The daily draw is seeded purely by the date, so everyone on Earth
 * gets the same card, aspect and window until local midnight.
 */

export type FateCard = {
  id: string;
  name: string;
  icon: string;
  motto: string;
  light: string;
  shadow: string;
};

export type DailyDraw = {
  card: FateCard;
  aspect: string;
  window: string;
  number: number;
  seed: string;
};

export const FATE_CARDS: FateCard[] = [
  { id: "wheel", name: "The Turning Wheel", icon: "LoaderPinwheel", motto: "All things move.", light: "Momentum swings your way — ride it before it turns again.", shadow: "Resist the spin and it will spin you." },
  { id: "door", name: "The Gilded Door", icon: "DoorOpen", motto: "An entrance dresses itself as an exit.", light: "A new opportunity stands open — walk through deliberately.", shadow: "Some doors only close once." },
  { id: "river", name: "Silent River", icon: "Shell", motto: "What floats away was never cargo.", light: "Release what is already leaving; the current is right.", shadow: "Gripping drifting things only tires the hands." },
  { id: "ember", name: "The Ember", icon: "Flame", motto: "Small heat outlives great flame.", light: "Steady effort beats one heroic push.", shadow: "A neglected small fire becomes a lost one." },
  { id: "storm", name: "Storm's Eye", icon: "CloudLightning", motto: "Calm is a place you stand, not a place you find.", light: "Composure wins the day before it starts.", shadow: "Confusing motion for progress." },
  { id: "ledger", name: "The Moon's Ledger", icon: "MoonStar", motto: "Not all accounts are settled in daylight.", light: "Trust the quiet read over the loud opinion.", shadow: "Secrets surface on their own schedule." },
  { id: "scale", name: "The Iron Scale", icon: "Scale", motto: "Weigh it once, then act.", light: "Fair judgment, swiftly delivered.", shadow: "Endless measuring starves the harvest." },
  { id: "crown", name: "The Hollow Crown", icon: "Crown", motto: "Heavy is the head; lighter is the hand that serves.", light: "Lead quietly and loyalty gathers.", shadow: "Pride takes rent from every room." },
  { id: "key", name: "The First Key", icon: "Key", motto: "One lock at a time.", light: "A breakthrough is closer than it looks.", shadow: "Stop revisiting rooms you have already opened." },
  { id: "compass", name: "The Long Compass", icon: "Compass", motto: "Direction beats speed.", light: "One honest course-correction outvalues ten sprints.", shadow: "Speed without bearing draws perfect circles." },
  { id: "anchor", name: "The Anchor's Dream", icon: "Anchor", motto: "Hold fast, but not forever.", light: "Stability is a weapon today.", shadow: "An anchor is a home until it is a grave." },
  { id: "feather", name: "The Feather Verdict", icon: "Feather", motto: "Some truths are light enough to float.", light: "Say the honest thing gently — it will land.", shadow: "Weightless promises sink the ship all the same." },
  { id: "gem", name: "The Veiled Gem", icon: "Gem", motto: "Worth waits to be recognized.", light: "A hidden strength gets seen today.", shadow: "Hiding yourself is also a choice." },
  { id: "winter", name: "The Winter Scholar", icon: "Snowflake", motto: "Study the season that freezes you.", light: "Patience turns winter into a teacher.", shadow: "Coldness mistaken for clarity." },
  { id: "swords", name: "The Twin Swords", icon: "Swords", motto: "Choose which battle is yours.", light: "One clean decision cuts the knot.", shadow: "Fighting yourself is the only unwinnable duel." },
  { id: "wheat", name: "The Golden Wheat", icon: "Wheat", motto: "Harvest favors the planted.", light: "Results arrive from work you almost forgot.", shadow: "Reaping before ripening costs the field." },
  { id: "eye", name: "The Sleepless Eye", icon: "Eye", motto: "What you watch, grows.", light: "Focused attention compounds fast.", shadow: "Watching without acting feeds only fear." },
  { id: "bridge", name: "The Quiet Bridge", icon: "Waypoints", motto: "Crossings appear to those already walking.", light: "Reconciliation is available now.", shadow: "Burned ropes are hard to re-tie." },
  { id: "scroll", name: "The Wandering Scroll", icon: "Scroll", motto: "Your story has margins.", light: "Rewrite a line today — it is allowed.", shadow: "Beware scripts written by other hands." },
  { id: "star", name: "The Unstable Star", icon: "Star", motto: "Navigate by it, but carry a lamp.", light: "Hope, backed by preparation, lands.", shadow: "Wishes are not a plan." },
];

export const ASPECTS = [
  "in stillness",
  "in motion",
  "through fire",
  "beneath a quiet moon",
  "at a crossroads",
  "among strangers",
  "in your own house",
  "against the current",
  "with open hands",
  "under pressure",
  "at the edge of the map",
  "in borrowed light",
  "on solid ground",
  "in the eleventh hour",
];

export const WINDOWS = [
  "dawn (5–8)",
  "morning (8–12)",
  "midday (12–15)",
  "dusk (17–20)",
  "night (20–24)",
];

export const ORACLE_ANSWERS = [
  "Ask again after you have moved one step.",
  "The answer is already in your hands; you just dislike it.",
  "Yes — but not on the schedule you imagined.",
  "No. Protect the time it would waste.",
  "Something must be left behind first.",
  "The door opens from the inside.",
  "Wait for the second invitation.",
  "It is already happening; do not interrupt it.",
  "Only if you say it out loud.",
  "Choose the version you will not have to explain later.",
  "The slow road arrives intact.",
  "What you feed grows. Decide what to feed.",
  "Someone is quietly hoping you will.",
  "Not yet — and the yet is doing heavy lifting.",
  "The risk is smaller than the regret.",
  "Rest is also a move.",
  "You have outgrown the question; upgrade it.",
  "Two doors. One is painted on. Test the hinges.",
  "Let it be easy for once.",
  "The omens favor the prepared.",
  "Keep it small and keep it yours.",
  "It will cost less than not knowing.",
  "You already know the first step. Take it before breakfast.",
  "Momentum forgives awkward beginnings.",
  "The timing is bad. Do it anyway.",
  "Guard the plan by starting silently.",
  "Everything you need is already nearby.",
  "Do not ask the mountain for permission.",
];

/** FNV-1a style string hash → 32-bit unsigned int. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, stable, good enough for fates. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local date key YYYY-MM-DD (the same key used by the store). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Deterministic daily draw for a date key. */
export function dailyDraw(dateKey: string): DailyDraw {
  const rng = mulberry32(hashSeed(`fate-v6::${dateKey}`));
  const card = FATE_CARDS[Math.floor(rng() * FATE_CARDS.length)];
  const aspect = ASPECTS[Math.floor(rng() * ASPECTS.length)];
  const window = WINDOWS[Math.floor(rng() * WINDOWS.length)];
  const number = 1 + Math.floor(rng() * 99);
  return { card, aspect, window, number, seed: dateKey };
}

/** Oracle: deterministic per question per hour bucket. */
export function oracleAnswer(question: string, at: Date = new Date()): string {
  const q = question.trim().toLowerCase();
  const hourBucket = Math.floor(at.getTime() / 3_600_000);
  const rng = mulberry32(hashSeed(`oracle::${q}::${hourBucket}`));
  return ORACLE_ANSWERS[Math.floor(rng() * ORACLE_ANSWERS.length)];
}

/** Consecutive-day streak from a map of date keys that have rolls. */
export function computeStreak(rolledDates: string[], now: Date = new Date()): number {
  const set = new Set(rolledDates);
  const day = new Date(now);
  day.setHours(12, 0, 0, 0); // avoid DST edges
  const key = (d: Date) => todayKey(d);

  if (!set.has(key(day))) day.setDate(day.getDate() - 1); // streak alive if yesterday rolled

  let streak = 0;
  while (set.has(key(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export function prettyDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
