/// <reference types="node" />
"use node";

import { createHash, randomBytes } from "node:crypto";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { diceMode, gameValue, type Snapshot } from "./lib/gameModel";

/** A capability authorizes one guest game, not a verified account name. */
export const start = action({
  args: { name: v.string(), diceCount: diceMode, aiOpponents: v.number() },
  returns: v.object({ gameId: v.id("games"), revision: v.number(), game: gameValue, secret: v.string() }),
  handler: async (ctx, args): Promise<Snapshot & { secret: string }> => {
    const secret = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(secret).digest("hex");
    const snapshot: Snapshot = await ctx.runMutation(internal.games.create, { ...args, tokenHash });
    return { ...snapshot, secret };
  },
});
