import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  gameLogs: defineTable({
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
    .index("by_gameId", ["gameId"]),

  // Durable receipts prevent replay even after a score leaves the top ten.
  // Additive schema change; existing scores are recognized on their first replay.
  highScoreReceipts: defineTable({
    gameId: v.string(),
    playerName: v.string(),
    isAi: v.boolean(),
    diceCount: v.number(),
  }).index("by_gameId_and_playerName_and_isAi_and_diceCount", ["gameId", "playerName", "isAi", "diceCount"]),

  highScores: defineTable({
    diceCount: v.number(),
    dateRecorded: v.string(),
    score: v.number(),
    playerName: v.string(),
    isAi: v.boolean(),
    gameId: v.string(),
  }).index("by_diceCount_score", ["diceCount", "score"]),
});
