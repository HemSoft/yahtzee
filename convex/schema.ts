import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { gameValue } from "./lib/gameModel";

export default defineSchema({
  // Temporary server-owned state. Arrays are bounded to 4 players and 20 dice.
  games: defineTable({
    tokenHash: v.string(), startedAt: v.number(), expiresAt: v.number(),
    revision: v.number(), game: gameValue,
  }),
  gameLogs: defineTable({
    // Legacy client-authored rows remain stored but are not trusted results.
    verified: v.optional(v.boolean()),
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
  })
    .index("by_diceCount", ["diceCount"])
    .index("by_gameId", ["gameId"])
    .index("by_verified", ["verified"])
    .index("by_verified_and_diceCount", ["verified", "diceCount"]),

  // Durable receipts prevent replay even after a score leaves the top ten.
  // Additive schema change; existing scores are recognized on their first replay.
  highScoreReceipts: defineTable({
    gameId: v.string(),
    playerName: v.string(),
    isAi: v.boolean(),
    diceCount: v.number(),
  }).index("by_gameId_and_playerName_and_isAi_and_diceCount", ["gameId", "playerName", "isAi", "diceCount"]),

  highScores: defineTable({
    verified: v.optional(v.boolean()),
    diceCount: v.number(),
    dateRecorded: v.string(),
    score: v.number(),
    playerName: v.string(),
    isAi: v.boolean(),
    gameId: v.string(),
  }).index("by_diceCount_score", ["diceCount", "score"])
    .index("by_diceCount_and_verified_and_score", ["diceCount", "verified", "score"]),
});
