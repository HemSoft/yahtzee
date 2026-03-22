import type { CategoryId } from "./scoring";
import { CATEGORIES, getCategories, getUpperBonusThreshold, getUpperBonusValue } from "./scoring";
import { rollDice, reroll } from "./dice";

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

  const threshold = getUpperBonusThreshold(diceCount);
  const bonusValue = getUpperBonusValue(diceCount);
  const upperBonus = upperSubtotal >= threshold ? bonusValue : 0;
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

function getMaxCategoryScore(catId: CategoryId, diceCount: number): number {
  switch (catId) {
    case "ones": return diceCount;
    case "twos": return diceCount * 2;
    case "threes": return diceCount * 3;
    case "fours": return diceCount * 4;
    case "fives": return diceCount * 5;
    case "sixes": return diceCount * 6;
    case "one-pair": return 12;
    case "two-pairs": return 22;
    case "three-of-a-kind": return 18;
    case "four-of-a-kind": return 24;
    case "full-house": return 25;
    case "small-straight": return 30;
    case "large-straight": return 40;
    case "yahtzee": return 50;
    case "chance": return diceCount * 6;
    case "three-pairs": return diceCount * 6 - 6;
    case "five-of-a-kind": return 30;
    case "full-straight": return 21;
    case "castle": return diceCount * 6 - 3;
    case "tower": return diceCount * 6 - 2;
    case "maxi-yahtzee": return 100;
    default: return 0;
  }
}

export function calculateMaxPossibleScore(player: PlayerState, diceCount: number): number {
  const cats = getCategories(diceCount);
  const threshold = getUpperBonusThreshold(diceCount);
  const bonusValue = getUpperBonusValue(diceCount);

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
  const maxBonus = maxUpper >= threshold ? bonusValue : 0;

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
  const cats = getCategories(diceCount);
  let bestId = available[0];
  let bestScore = -1;
  for (const id of available) {
    const cat = cats.find((c) => c.id === id)!;
    const s = cat.score(dice);
    if (s > bestScore || (s === bestScore && bestId === "chance")) {
      bestScore = s;
      bestId = id;
    }
  }
  return bestId;
}

/** Execute a full AI turn: roll 3 times (no holding strategy), pick best category. */
export function executeAiTurn(game: GameState): GameState {
  const player = game.players[game.currentPlayerIndex];
  const cats = getCategories(game.diceCount);
  let dice = rollDice(game.diceCount);

  // Simple AI: re-roll twice (no hold strategy — keeps it fair-ish)
  dice = rollDice(game.diceCount);
  dice = rollDice(game.diceCount);

  const categoryId = pickAiCategory(dice, player, game.diceCount);
  const cat = cats.find((c) => c.id === categoryId)!;

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
