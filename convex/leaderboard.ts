import { query } from "./_generated/server";
import { v } from "convex/values";

export const top = query({
  args: {
    diceCount: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    let q = ctx.db.query("leaderboard");

    if (args.diceCount !== undefined) {
      q = q.withIndex("by_dice_score", (idx) =>
        idx.eq("diceCount", args.diceCount!)
      );
    }

    const entries = await q.order("desc").take(limit);

    return entries.map((entry, i) => ({
      rank: i + 1,
      playerName: entry.playerName,
      score: entry.score,
      diceCount: entry.diceCount,
      date: new Date(entry._creationTime).toLocaleDateString(),
    }));
  },
});
