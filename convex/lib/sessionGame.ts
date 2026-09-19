import { createGame, executeAiTurn, isGameComplete, type GameState } from "../../packages/game-engine/src/game";
import { rollDice, reroll } from "../../packages/game-engine/src/dice";
import { getCategories } from "../../packages/game-engine/src/scoring";
import { checkedDiceCount, fromWire, toWire, type WireGame } from "./gameModel";

export function newGuestGame(name: string, diceCount: number, aiOpponents: number): WireGame {
  checkedDiceCount(diceCount);
  if (!Number.isSafeInteger(aiOpponents) || aiOpponents < 0 || aiOpponents > 3) {
    throw new Error("Choose zero to three AI opponents");
  }
  const game = createGame({ id: "", diceCount, players: [
    { id: "human", name, isAi: false },
    ...Array.from({ length: aiOpponents }, (_, index) => ({ id: `ai-${index + 1}`, name: ["Bot Alpha", "Bot Beta", "Bot Gamma"][index], isAi: true })),
  ] });
  return toWire({ ...game, status: "playing", dice: rollDice(diceCount), rollsLeft: 2 });
}

function advance(game: GameState): GameState {
  if (isGameComplete(game)) return { ...game, status: "finished" };
  const next = (game.currentPlayerIndex + 1) % game.players.length;
  return { ...game, currentPlayerIndex: next,
    currentRound: game.currentRound + (next === 0 ? 1 : 0),
    dice: new Array(game.diceCount).fill(0), held: new Set(), rollsLeft: game.maxRolls };
}

export type Move = { kind: "roll" } | { kind: "hold"; index: number } | { kind: "score"; category: string };

/** Only choices cross the public API; rolls, AI turns and scores stay here. */
export function applyMove(wire: WireGame, move: Move): WireGame {
  let game = fromWire(wire);
  if (game.status !== "playing" || game.players[game.currentPlayerIndex].isAi) throw new Error("Not a human turn");
  if (move.kind === "hold") {
    if (!Number.isSafeInteger(move.index) || move.index < 0 || move.index >= game.diceCount) throw new Error("Invalid die index");
    if (game.held.has(move.index)) game.held.delete(move.index);
    else game.held.add(move.index);
    return toWire(game);
  }
  if (move.kind === "roll") {
    if (game.rollsLeft <= 0) throw new Error("No rolls remain");
    return toWire({ ...game, dice: reroll(game.dice, game.held), rollsLeft: game.rollsLeft - 1 });
  }
  const category = getCategories(game.diceCount).find((entry) => entry.id === move.category);
  const player = game.players[game.currentPlayerIndex];
  if (!category || player.scores[category.id] !== undefined) throw new Error("Category is unavailable");
  game.players[game.currentPlayerIndex] = { ...player, scores: { ...player.scores, [category.id]: category.score(game.dice) } };
  game = advance(game);
  // At most three AI turns. Clients cannot supply AI dice or scores.
  while (game.status === "playing" && game.players[game.currentPlayerIndex].isAi) {
    game = advance(executeAiTurn(game));
  }
  if (game.status === "playing") game = { ...game, dice: rollDice(game.diceCount), rollsLeft: game.maxRolls - 1 };
  return toWire(game);
}
