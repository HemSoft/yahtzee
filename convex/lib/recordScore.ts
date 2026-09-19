import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export type ScoreSubmission = Omit<Doc<"highScores">, "_id" | "_creationTime" | "verified">;
const LIMIT = 10;

/** One game/player/dice-mode result, including non-qualifying results, is final.
 * The indexed read and receipt insert share the mutation transaction. Convex
 * OCC retries concurrent writers, so they observe the committed receipt.
 */
export async function recordScore(ctx: MutationCtx, args: ScoreSubmission) {
  if (!Number.isSafeInteger(args.score) || args.score < 0) {
    throw new Error("Score must be a finite nonnegative integer");
  }
  const receipt = await ctx.db.query("highScoreReceipts")
    .withIndex("by_gameId_and_playerName_and_isAi_and_diceCount", (q) => q
      .eq("gameId", args.gameId).eq("playerName", args.playerName)
      .eq("isAi", args.isAi).eq("diceCount", args.diceCount))
    .unique();
  if (receipt) return;

  await ctx.db.insert("highScoreReceipts", {
    gameId: args.gameId, playerName: args.playerName,
    isAi: args.isAi, diceCount: args.diceCount,
  });
  const existing = await ctx.db.query("highScores")
    .withIndex("by_diceCount_and_verified_and_score", (q) => q.eq("diceCount", args.diceCount).eq("verified", true))
    .order("desc").take(LIMIT);
  // Recognize a verified row even if its receipt is absent. Unverified legacy
  // rows are preserved, but cannot displace server-verified results.
  if (existing.some((row) => row.gameId === args.gameId &&
    row.playerName === args.playerName && row.isAi === args.isAi)) return;
  if (existing.length === LIMIT && args.score <= existing[LIMIT - 1].score) return;

  await ctx.db.insert("highScores", { ...args, verified: true });
  if (existing.length === LIMIT) await ctx.db.delete(existing[LIMIT - 1]._id);
}
