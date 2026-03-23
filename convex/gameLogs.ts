import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gameLogs")
      .withIndex("by_gameId", (q) => q.eq("gameId", args.gameId))
      .first();
    if (existing) return;
    await ctx.db.insert("gameLogs", args);
  },
});

export const list = query({
  args: { diceCount: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (args.diceCount !== undefined) {
      return await ctx.db
        .query("gameLogs")
        .withIndex("by_diceCount", (q) => q.eq("diceCount", args.diceCount!))
        .take(200);
    }
    return await ctx.db.query("gameLogs").order("desc").take(200);
  },
});
