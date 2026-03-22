import { query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_game_player", (q) => q.eq("gameId", args.gameId))
      .collect();

    return { game, players, scores };
  },
});
