/**
 * Yahtzee scoring categories.
 *
 * Upper section: ones–sixes (extendable for N dice).
 * Lower section: classic combos.
 */

// ─── Helpers ──────────────────────────────────────────────

/** Count occurrences of each die face. Index 0 is unused; index 1–6 hold counts. */
function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

function hasNOfAKind(dice: number[], n: number): boolean {
  return counts(dice).some((c) => c >= n);
}

// ─── Upper Section ────────────────────────────────────────

/** Score for a specific face value (1–6). */
export function upperScore(dice: number[], face: number): number {
  return dice.filter((d) => d === face).length * face;
}

// ─── Lower Section ────────────────────────────────────────

/** Highest pair — sum of the two matching dice. */
export function onePair(dice: number[]): number {
  const c = counts(dice);
  for (let face = 6; face >= 1; face--) {
    if (c[face] >= 2) return face * 2;
  }
  return 0;
}

/** Two different pairs — sum of all four dice. */
export function twoPairs(dice: number[]): number {
  const c = counts(dice);
  const pairs: number[] = [];
  for (let face = 6; face >= 1; face--) {
    if (c[face] >= 2) pairs.push(face);
  }
  if (pairs.length >= 2) return pairs[0] * 2 + pairs[1] * 2;
  return 0;
}

export function threeOfAKind(dice: number[]): number {
  return hasNOfAKind(dice, 3) ? sum(dice) : 0;
}

export function fourOfAKind(dice: number[]): number {
  return hasNOfAKind(dice, 4) ? sum(dice) : 0;
}

export function fullHouse(dice: number[]): number {
  const c = counts(dice);
  const vals = c.filter((v) => v > 0);
  // Classic: exactly a pair + a triple (works for 5 dice)
  if (vals.length === 2 && vals.includes(2) && vals.includes(3)) return 25;
  // Extended: for 6+ dice, also accept 3+3 or 2+4 etc.
  if (dice.length > 5) {
    const sorted = vals.sort((a, b) => a - b);
    if (sorted.length === 2 && sorted[0] >= 2 && sorted[1] >= 3) return 25;
  }
  return 0;
}

export function smallStraight(dice: number[]): number {
  const unique = new Set(dice);
  const runs = [
    [1, 2, 3, 4],
    [2, 3, 4, 5],
    [3, 4, 5, 6],
  ];
  return runs.some((run) => run.every((v) => unique.has(v))) ? 30 : 0;
}

export function largeStraight(dice: number[]): number {
  const unique = new Set(dice);
  const runs = [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
  ];
  return runs.some((run) => run.every((v) => unique.has(v))) ? 40 : 0;
}

export function yahtzee(dice: number[]): number {
  return hasNOfAKind(dice, dice.length) ? 50 : 0;
}

export function chance(dice: number[]): number {
  return sum(dice);
}

// ─── Category Registry ────────────────────────────────────

export type CategoryId =
  | "ones"
  | "twos"
  | "threes"
  | "fours"
  | "fives"
  | "sixes"
  | "one-pair"
  | "two-pairs"
  | "three-of-a-kind"
  | "four-of-a-kind"
  | "full-house"
  | "small-straight"
  | "large-straight"
  | "yahtzee"
  | "chance";

export interface Category {
  id: CategoryId;
  label: string;
  section: "upper" | "lower";
  score: (dice: number[]) => number;
}

export const CATEGORIES: Category[] = [
  { id: "ones", label: "Ones", section: "upper", score: (d) => upperScore(d, 1) },
  { id: "twos", label: "Twos", section: "upper", score: (d) => upperScore(d, 2) },
  { id: "threes", label: "Threes", section: "upper", score: (d) => upperScore(d, 3) },
  { id: "fours", label: "Fours", section: "upper", score: (d) => upperScore(d, 4) },
  { id: "fives", label: "Fives", section: "upper", score: (d) => upperScore(d, 5) },
  { id: "sixes", label: "Sixes", section: "upper", score: (d) => upperScore(d, 6) },
  { id: "one-pair", label: "One Pair", section: "lower", score: onePair },
  { id: "two-pairs", label: "Two Pairs", section: "lower", score: twoPairs },
  { id: "three-of-a-kind", label: "Three of a Kind", section: "lower", score: threeOfAKind },
  { id: "four-of-a-kind", label: "Four of a Kind", section: "lower", score: fourOfAKind },
  { id: "full-house", label: "Full House", section: "lower", score: fullHouse },
  { id: "small-straight", label: "Small Straight", section: "lower", score: smallStraight },
  { id: "large-straight", label: "Large Straight", section: "lower", score: largeStraight },
  { id: "yahtzee", label: "Yahtzee", section: "lower", score: yahtzee },
  { id: "chance", label: "Chance", section: "lower", score: chance },
];

/** Upper section bonus threshold and value. */
export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_VALUE = 35;
