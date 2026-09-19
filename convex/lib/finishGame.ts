import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { calculateTotal, calculateMaxPossibleScore, isGameComplete } from "../../packages/game-engine/src/game";
import { getCategories } from "../../packages/game-engine/src/scoring";
import { fromWire, guestName, type WireGame } from "./gameModel";
import { recordScore } from "./recordScore";

/** Called only inside the authorized move transaction. No caller totals exist. */
export async function finishGame(ctx: MutationCtx, session: Doc<"games">, wire: WireGame, now: number) {
  const game = fromWire(wire);
  if (game.status !== "finished" || !isGameComplete(game) || game.players.length < 1 || game.players.length > 4) {
    throw new Error("Incomplete game");
  }
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(session.startedAt)
    || now < session.startedAt || now > session.expiresAt) throw new Error("Invalid game duration");
  const categories = new Set(getCategories(game.diceCount).map((category) => category.id as string));
  const players = game.players.map((player) => {
    guestName(player.name);
    const entries = Object.entries(player.scores);
    if (entries.length !== categories.size || entries.some(([key, value]) =>
      !categories.has(key) || !Number.isSafeInteger(value) || value! < 0)) throw new Error("Invalid scorecard");
    const score = calculateTotal(player, game.diceCount).grandTotal;
    const maximum = calculateMaxPossibleScore({ ...player, scores: {} }, game.diceCount);
    if (!Number.isSafeInteger(score) || score < 0 || score > maximum) throw new Error("Impossible total");
    return { name: player.name, isAi: !!player.isAi, score, scores: wire.players.find((p) => p.id === player.id)!.scores };
  });
  const previous = await ctx.db.query("gameLogs").withIndex("by_gameId", (q) => q.eq("gameId", session._id)).unique();
  if (previous) throw new Error("Game result already exists");
  const completedAt = new Date(now).toISOString();
  await ctx.db.insert("gameLogs", {
    gameId: session._id, verified: true, diceCount: game.diceCount,
    startedAt: new Date(session.startedAt).toISOString(), completedAt,
    durationSeconds: Math.floor((now - session.startedAt) / 1000), players,
    winnerName: [...players].sort((a, b) => b.score - a.score)[0].name,
  });
  for (const player of players) {
    await recordScore(ctx, { gameId: session._id, diceCount: game.diceCount,
      dateRecorded: completedAt, playerName: player.name, isAi: player.isAi, score: player.score });
  }
}
