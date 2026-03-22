import type { CategoryId } from "./scoring";
import { CATEGORIES, UPPER_BONUS_THRESHOLD, UPPER_BONUS_VALUE } from "./scoring";

// ─── Types ────────────────────────────────────────────────

export interface PlayerState {
  id: string;
  name: string;
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
  players: { id: string; name: string }[];
}): GameState {
  const totalRounds = CATEGORIES.length; // 13 rounds
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

export function calculateTotal(player: PlayerState): {
  upperSubtotal: number;
  upperBonus: number;
  lowerSubtotal: number;
  grandTotal: number;
} {
  let upperSubtotal = 0;
  let lowerSubtotal = 0;

  for (const cat of CATEGORIES) {
    const val = player.scores[cat.id];
    if (val === undefined) continue;
    if (cat.section === "upper") upperSubtotal += val;
    else lowerSubtotal += val;
  }

  const upperBonus = upperSubtotal >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;
  const grandTotal = upperSubtotal + upperBonus + lowerSubtotal;

  return { upperSubtotal, upperBonus, lowerSubtotal, grandTotal };
}

export function isGameComplete(game: GameState): boolean {
  return game.players.every(
    (p) => Object.keys(p.scores).length === CATEGORIES.length
  );
}

export function getAvailableCategories(player: PlayerState): CategoryId[] {
  return CATEGORIES.filter((c) => player.scores[c.id] === undefined).map((c) => c.id);
}
