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

  highScores: defineTable({
    diceCount: v.number(),
    dateRecorded: v.string(),
    score: v.number(),
    playerName: v.string(),
    isAi: v.boolean(),
    gameId: v.string(),
  }).index("by_diceCount_score", ["diceCount", "score"]),
});
