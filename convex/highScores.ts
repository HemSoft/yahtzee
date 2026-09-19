import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkedDiceCount, diceMode } from "./lib/gameModel";

export const submit = mutation({
  args: {
    diceCount: v.number(),
    dateRecorded: v.string(),
    score: v.number(),
    playerName: v.string(),
    isAi: v.boolean(),
    gameId: v.string(),
  },
  handler: async () => {
    throw new Error("Direct score submission is disabled. Complete a server-owned guest game.");
  },
});

export const top = query({
  args: { diceCount: diceMode },
  handler: async (ctx, args) => {
    checkedDiceCount(args.diceCount);
    const entries = await ctx.db.query("highScores")
      .withIndex("by_diceCount_and_verified_and_score", (q) => q.eq("diceCount", args.diceCount).eq("verified", true))
      .order("desc").take(10);
    return entries.map((entry, i) => ({ ...entry, rankCurrent: i + 1 }));
  },
});
