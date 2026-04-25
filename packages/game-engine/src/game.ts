import type { CategoryId } from "./scoring";
import { CATEGORIES, getCategories, getUpperBonusThreshold, getUpperBonusValue } from "./scoring";
import { rollDice } from "./dice";

// ─── Types ────────────────────────────────────────────────

export interface PlayerState {
  id: string;
  name: string;
  isAi?: boolean;
  /** Scores keyed by category id. `undefined` = not yet scored. */
  scores: Partial<Record<CategoryId, number>>;
}

export interface GameState {
  id: string;
  diceCount: number;
  maxRolls: number;
  dice: number[];
  held: Set<number>;
  rollsLeft: number;
  players: PlayerState[];
  currentPlayerIndex: number;
  currentRound: number;
  totalRounds: number;
  status: "lobby" | "playing" | "finished";
}

// ─── Factory ──────────────────────────────────────────────

export function createGame(opts: {
  id: string;
  diceCount: number;
  players: { id: string; name: string; isAi?: boolean }[];
}): GameState {
  const totalRounds = getCategories(opts.diceCount).length;
  return {
    id: opts.id,
    diceCount: opts.diceCount,
    maxRolls: 3,
    dice: new Array(opts.diceCount).fill(0),
    held: new Set(),
    rollsLeft: 3,
    players: opts.players.map((p) => ({ ...p, scores: {} })),
    currentPlayerIndex: 0,
    currentRound: 1,
    totalRounds,
    status: "lobby",
  };
}

// ─── Score Calculation ────────────────────────────────────

/** Return the upper bonus if `upperTotal` meets the threshold for `diceCount`, else 0. */
export function getUpperBonus(upperTotal: number, diceCount: number): number {
  return upperTotal >= getUpperBonusThreshold(diceCount)
    ? getUpperBonusValue(diceCount)
    : 0;
}

export function calculateTotal(player: PlayerState, diceCount: number = 5): {
  upperSubtotal: number;
  upperBonus: number;
  lowerSubtotal: number;
  grandTotal: number;
} {
  let upperSubtotal = 0;
  let lowerSubtotal = 0;

  const cats = getCategories(diceCount);
  for (const cat of cats) {
    const val = player.scores[cat.id];
    if (val === undefined) continue;
    if (cat.section === "upper") upperSubtotal += val;
    else lowerSubtotal += val;
  }

  const upperBonus = getUpperBonus(upperSubtotal, diceCount);
  const grandTotal = upperSubtotal + upperBonus + lowerSubtotal;

  return { upperSubtotal, upperBonus, lowerSubtotal, grandTotal };
}

export function isGameComplete(game: GameState): boolean {
  const cats = getCategories(game.diceCount);
  return game.players.every(
    (p) => Object.keys(p.scores).length === cats.length
  );
}

// ─── Max Possible Score ───────────────────────────────────

type MaxScoreEntry = number | ((diceCount: number) => number);

const MAX_SCORE_TABLE: Record<CategoryId, MaxScoreEntry> = {
  "ones": (d) => d,
  "twos": (d) => d * 2,
  "threes": (d) => d * 3,
  "fours": (d) => d * 4,
  "fives": (d) => d * 5,
  "sixes": (d) => d * 6,
  "one-pair": 12,
  "two-pairs": 22,
  "three-of-a-kind": 18,
  "four-of-a-kind": 24,
  "full-house": 25,
  "small-straight": 30,
  "large-straight": 40,
  "yahtzee": 50,
  "chance": (d) => d * 6,
  "three-pairs": (d) => d * 6 - 6,
  "five-of-a-kind": 30,
  "full-straight": 21,
  "castle": (d) => d * 6 - 3,
  "tower": (d) => d * 6 - 2,
  "maxi-yahtzee": 100,
};

function getMaxCategoryScore(catId: CategoryId, diceCount: number): number {
  const entry = MAX_SCORE_TABLE[catId];
  return typeof entry === "function" ? entry(diceCount) : entry;
}

export function calculateMaxPossibleScore(player: PlayerState, diceCount: number): number {
  const cats = getCategories(diceCount);

  let upperScored = 0;
  let lowerScored = 0;
  let maxUpperRemaining = 0;
  let maxLowerRemaining = 0;

  for (const cat of cats) {
    const scored = player.scores[cat.id];
    if (scored !== undefined) {
      if (cat.section === "upper") upperScored += scored;
      else lowerScored += scored;
    } else {
      const maxVal = getMaxCategoryScore(cat.id, diceCount);
      if (cat.section === "upper") maxUpperRemaining += maxVal;
      else maxLowerRemaining += maxVal;
    }
  }

  const maxUpper = upperScored + maxUpperRemaining;
  const maxBonus = getUpperBonus(maxUpper, diceCount);

  return maxUpper + maxBonus + lowerScored + maxLowerRemaining;
}

export function getAvailableCategories(player: PlayerState, diceCount: number = 5): CategoryId[] {
  const cats = getCategories(diceCount);
  return cats.filter((c) => player.scores[c.id] === undefined).map((c) => c.id);
}

// ─── AI Logic ─────────────────────────────────────────────

/** Pick the best available category for the AI (greedy: highest score, Chance as last resort). */
export function pickAiCategory(
  dice: number[],
  player: PlayerState,
  diceCount: number = 5
): CategoryId {
  const available = getAvailableCategories(player, diceCount);
  const catMap = new Map(getCategories(diceCount).map((c) => [c.id, c]));
  let bestId = available[0];
  let bestScore = -1;

  for (const id of available) {
    const s = catMap.get(id)!.score(dice);
    if (s > bestScore || (s === bestScore && bestId === "chance")) {
      bestScore = s;
      bestId = id;
    }
  }
  return bestId;
}

/** Execute a full AI turn: roll dice once (no holding strategy), pick best category. */
export function executeAiTurn(game: GameState): GameState {
  const player = game.players[game.currentPlayerIndex];
  const catMap = new Map(getCategories(game.diceCount).map((c) => [c.id, c]));
  const dice = rollDice(game.diceCount);

  const categoryId = pickAiCategory(dice, player, game.diceCount);
  const cat = catMap.get(categoryId)!;

  const updatedPlayer = {
    ...player,
    scores: { ...player.scores, [categoryId]: cat.score(dice) },
  };

  const newPlayers = [...game.players];
  newPlayers[game.currentPlayerIndex] = updatedPlayer;

  return {
    ...game,
    players: newPlayers,
    dice,
    held: new Set(),
    rollsLeft: game.maxRolls,
  };
}
