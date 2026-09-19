import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { diceMode, guestName, snapshotValue, type Snapshot } from "./lib/gameModel";
import { applyMove, newGuestGame } from "./lib/sessionGame";
import { finishGame } from "./lib/finishGame";

const LIFETIME = 12 * 60 * 60 * 1000;
const credentials = { gameId: v.id("games"), secret: v.string() };

function snapshot(session: Doc<"games">): Snapshot {
  return { gameId: session._id, revision: session.revision, game: session.game };
}

async function authorize(ctx: QueryCtx | MutationCtx, gameId: Id<"games">, secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Unauthorized game");
  const session = await ctx.db.get(gameId);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (!session || hash !== session.tokenHash) throw new Error("Unauthorized game");
  if (Date.now() >= session.expiresAt) throw new Error("Guest game expired");
  return session;
}

export const create = internalMutation({
  args: { name: v.string(), diceCount: diceMode, aiOpponents: v.number(), tokenHash: v.string() },
  returns: snapshotValue,
  handler: async (ctx, args): Promise<Snapshot> => {
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash)) throw new Error("Invalid capability hash");
    const game = newGuestGame(guestName(args.name), args.diceCount, args.aiOpponents);
    const startedAt = Date.now();
    const gameId = await ctx.db.insert("games", {
      tokenHash: args.tokenHash, startedAt, expiresAt: startedAt + LIFETIME, revision: 0, game,
    });
    game.id = gameId;
    await ctx.db.patch(gameId, { game });
    await ctx.scheduler.runAfter(LIFETIME, internal.games.expire, { gameId });
    return { gameId, revision: 0, game };
  },
});

export const expire = internalMutation({
  args: { gameId: v.id("games") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.gameId);
    if (session && Date.now() >= session.expiresAt) await ctx.db.delete(args.gameId);
    return null;
  },
});

export const read = query({
  args: credentials,
  returns: snapshotValue,
  handler: async (ctx, args): Promise<Snapshot> => snapshot(await authorize(ctx, args.gameId, args.secret)),
});

export const move = mutation({
  args: { ...credentials, revision: v.number(), move: v.union(
    v.object({ kind: v.literal("roll") }),
    v.object({ kind: v.literal("hold"), index: v.number() }),
    v.object({ kind: v.literal("score"), category: v.string() }),
  ) },
  returns: snapshotValue,
  handler: async (ctx, args): Promise<Snapshot> => {
    const session = await authorize(ctx, args.gameId, args.secret);
    if (!Number.isSafeInteger(args.revision) || args.revision < 0 || args.revision > session.revision) {
      throw new Error("Invalid game revision");
    }
    // Retrying a request after a lost response observes its committed result.
    if (args.revision < session.revision) return snapshot(session);
    const game = applyMove(session.game, args.move);
    if (game.status === "finished") await finishGame(ctx, session, game, Date.now());
    const revision = session.revision + 1;
    await ctx.db.patch(session._id, { game, revision });
    return { gameId: session._id, revision, game };
  },
});
