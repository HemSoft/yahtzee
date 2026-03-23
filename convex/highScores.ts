import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_HIGH_SCORES_PER_DICE_COUNT = 10;

export const submit = mutation({
  args: {
    diceCount: v.number(),
    dateRecorded: v.string(),
    score: v.number(),
    playerName: v.string(),
    isAi: v.boolean(),
    gameId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get existing entries for this dice count, sorted desc
    const existing = await ctx.db
      .query("highScores")
      .withIndex("by_diceCount_score", (q) => q.eq("diceCount", args.diceCount))
      .collect();

    const sorted = existing.sort((a, b) => b.score - a.score);

    // Check if this score qualifies
    const qualifies =
      sorted.length < MAX_HIGH_SCORES_PER_DICE_COUNT ||
      args.score >= sorted[sorted.length - 1].score;

    if (!qualifies) return;

    // Insert the new score
    await ctx.db.insert("highScores", args);

    // If over limit, remove the lowest
    if (sorted.length >= MAX_HIGH_SCORES_PER_DICE_COUNT) {
      // Re-fetch to include the new one
      const all = await ctx.db
        .query("highScores")
        .withIndex("by_diceCount_score", (q) => q.eq("diceCount", args.diceCount))
        .collect();
      const sortedAll = all.sort((a, b) => b.score - a.score);
      // Delete everything after the top N
      for (let i = MAX_HIGH_SCORES_PER_DICE_COUNT; i < sortedAll.length; i++) {
        await ctx.db.delete(sortedAll[i]._id);
      }
    }
  },
});

export const top = query({
  args: { diceCount: v.number() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("highScores")
      .withIndex("by_diceCount_score", (q) => q.eq("diceCount", args.diceCount))
      .collect();

    return entries
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HIGH_SCORES_PER_DICE_COUNT)
      .map((e, i) => ({
        ...e,
        rankCurrent: i + 1,
      }));
  },
});
