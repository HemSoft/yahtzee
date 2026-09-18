import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { recordScore } from "./lib/recordScore";

export const submit = mutation({
  args: {
    diceCount: v.number(),
    dateRecorded: v.string(),
    score: v.number(),
    playerName: v.string(),
    isAi: v.boolean(),
    gameId: v.string(),
  },
  handler: recordScore,
});

export const top = query({
  args: { diceCount: v.number() },
  handler: async (ctx, args) => {
    const entries = await ctx.db.query("highScores")
      .withIndex("by_diceCount_score", (q) => q.eq("diceCount", args.diceCount))
      .order("desc").take(10);
    return entries.map((entry, i) => ({ ...entry, rankCurrent: i + 1 }));
  },
});
