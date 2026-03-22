import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    hostPlayerId: v.string(),
    diceCount: v.number(),
    maxRolls: v.number(),
    status: v.union(
      v.literal("lobby"),
      v.literal("playing"),
      v.literal("finished")
    ),
    playerIds: v.array(v.string()),
    currentPlayerIndex: v.number(),
    currentRound: v.number(),
    totalRounds: v.number(),
    dice: v.array(v.number()),
    held: v.array(v.number()),
    rollsLeft: v.number(),
  })
    .index("by_status", ["status"]),

  players: defineTable({
    name: v.string(),
    gameId: v.id("games"),
  })
    .index("by_game", ["gameId"]),

  scores: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    category: v.string(),
    value: v.number(),
  })
    .index("by_game_player", ["gameId", "playerId"]),

  leaderboard: defineTable({
    playerName: v.string(),
    score: v.number(),
    diceCount: v.number(),
  })
    .index("by_dice_score", ["diceCount", "score"]),
});
