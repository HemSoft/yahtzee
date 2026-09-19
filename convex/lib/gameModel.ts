import { v, type Infer } from "convex/values";
import type { GameState } from "../../packages/game-engine/src/game";

export const diceMode = v.number();
export function checkedDiceCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 2 || value > 20) throw new Error("Dice count must be an integer from 2 to 20");
  return value;
}
export const gameValue = v.object({
  id: v.string(), diceCount: diceMode, maxRolls: v.number(),
  dice: v.array(v.number()), held: v.array(v.number()), rollsLeft: v.number(),
  players: v.array(v.object({
    id: v.string(), name: v.string(), isAi: v.boolean(),
    scores: v.record(v.string(), v.number()),
  })),
  currentPlayerIndex: v.number(), currentRound: v.number(), totalRounds: v.number(),
  status: v.union(v.literal("lobby"), v.literal("playing"), v.literal("finished")),
});
export const snapshotValue = v.object({
  gameId: v.id("games"), revision: v.number(), game: gameValue,
});
export type WireGame = Infer<typeof gameValue>;
export type Snapshot = Infer<typeof snapshotValue>;

export function toWire(game: GameState): WireGame {
  checkedDiceCount(game.diceCount);
  return {
    ...game, diceCount: game.diceCount, held: [...game.held],
    players: game.players.map((player) => {
      const scores: Record<string, number> = {};
      for (const [key, score] of Object.entries(player.scores)) {
        if (score !== undefined) scores[key] = score;
      }
      return { ...player, isAi: !!player.isAi, scores };
    }),
  };
}

export function fromWire(game: WireGame): GameState {
  return { ...game, dice: [...game.dice], held: new Set(game.held),
    players: game.players.map((player) => ({ ...player, scores: { ...player.scores } })) };
}

export function guestName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 32 || [...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) {
    throw new Error("Guest name must contain 1 to 32 printable characters");
  }
  return name;
}
