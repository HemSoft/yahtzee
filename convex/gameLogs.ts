import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkedDiceCount, diceMode } from "./lib/gameModel";

export const add = mutation({
  args: {
    gameId: v.string(),
    diceCount: v.number(),
    startedAt: v.string(),
    completedAt: v.string(),
    durationSeconds: v.number(),
    players: v.array(
      v.object({
        name: v.string(),
        isAi: v.boolean(),
        score: v.number(),
        scores: v.record(v.string(), v.number()),
      })
    ),
    winnerName: v.string(),
  },
  handler: async () => {
    throw new Error("Direct game-log submission is disabled. Complete a server-owned guest game.");
  },
});

export const list = query({
  args: { diceCount: v.optional(diceMode) },
  handler: async (ctx, args) => {
    if (args.diceCount !== undefined) {
      checkedDiceCount(args.diceCount);
      return await ctx.db
        .query("gameLogs")
        .withIndex("by_verified_and_diceCount", (q) => q.eq("verified", true).eq("diceCount", args.diceCount!))
        .order("desc").take(200);
    }
    return await ctx.db.query("gameLogs").withIndex("by_verified", (q) => q.eq("verified", true)).order("desc").take(200);
  },
});
