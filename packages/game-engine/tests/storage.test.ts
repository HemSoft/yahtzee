import { describe, it, expect, setSystemTime } from "bun:test";
import {
  createEmptyGameLog,
  addGameLogEntry,
  getPlayerAverageScore,
  getPlayerGameCount,
  createEmptyHighScores,
  updateHighScores,
  getHighScoresForDiceCount,
} from "../src/storage";
import type { PlayerState } from "../src/game";

function makePlayer(name: string, scores: Partial<Record<string, number>>, isAi = false): PlayerState {
  return { id: name, name, isAi, scores };
}

describe("Game Log", () => {
  it("records rounded seconds, copied scores and the first tied winner", () => {
    setSystemTime(new Date("2026-03-22T10:00:05.600Z"));
    try {
      const players = [makePlayer("Alice", { chance: 10 }), makePlayer("Bob", { chance: 10 }), makePlayer("Carol", { chance: 5 })];
      const log = addGameLogEntry(createEmptyGameLog(), { id: "clock", diceCount: 5, players }, "2026-03-22T10:00:00.000Z");
      expect(log.entries[0].durationSeconds).toBe(6);
      expect(log.entries[0].completedAt).toBe("2026-03-22T10:00:05.600Z");
      expect(log.entries[0].winnerName).toBe("Alice");
      players[0].scores.chance = 99;
      expect(log.entries[0].players[0].scores).toEqual({ chance: 10 });
    } finally { setSystemTime(); }
  });

  it("filters both dice mode and player when aggregating multiplayer logs", () => {
    let log = createEmptyGameLog();
    const games = [
      { id: "a", diceCount: 5, players: [makePlayer("Alice", { chance: 10 }), makePlayer("Bob", { chance: 20 })] },
      { id: "b", diceCount: 6, players: [makePlayer("Alice", { chance: 36 }), makePlayer("Bob", { chance: 35 })] },
      { id: "c", diceCount: 5, players: [makePlayer("Bob", { chance: 25 })] },
      { id: "d", diceCount: 5, players: [makePlayer("Alice", { chance: 21 }), makePlayer("Bob", { chance: 9 })] },
    ];
    for (const game of games) log = addGameLogEntry(log, game, "2026-03-22T10:00:00Z");
    expect(getPlayerAverageScore(log, "Alice", 5)).toBe(16);
    expect(getPlayerAverageScore(log, "Alice", 6)).toBe(36);
    expect(getPlayerAverageScore(log, "Bob", 5)).toBe(18);
    expect(getPlayerAverageScore(log, "Nobody", 5)).toBe(0);
    expect(getPlayerGameCount(log, "Alice", 5)).toBe(2);
    expect(getPlayerGameCount(log, "Alice", 6)).toBe(1);
    expect(getPlayerGameCount(log, "Bob", 5)).toBe(3);
    expect(getPlayerGameCount(log, "Nobody", 5)).toBe(0);
  });
  it("starts empty", () => {
    const log = createEmptyGameLog();
    expect(log.entries).toHaveLength(0);
  });

  it("adds a game log entry with correct fields", () => {
    const log = createEmptyGameLog();
    const players: PlayerState[] = [
      makePlayer("Alice", { ones: 3, twos: 6, "three-of-a-kind": 20 }),
      makePlayer("Bot", { ones: 5, twos: 8, "three-of-a-kind": 25 }, true),
    ];
    const game = { id: "game-1", diceCount: 5, players };
    const updated = addGameLogEntry(log, game, "2026-03-22T10:00:00Z");

    expect(updated.entries).toHaveLength(1);
    const entry = updated.entries[0];
    expect(entry.id).toBe("game-1");
    expect(entry.diceCount).toBe(5);
    expect(entry.startedAt).toBe("2026-03-22T10:00:00Z");
    expect(entry.completedAt).toBeTruthy();
    expect(entry.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(entry.players).toHaveLength(2);
    expect(entry.players[0].name).toBe("Alice");
    expect(entry.players[0].isAi).toBe(false);
    expect(entry.players[0].score).toBe(29); // 3+6+20
    expect(entry.players[1].name).toBe("Bot");
    expect(entry.players[1].isAi).toBe(true);
    expect(entry.players[1].score).toBe(38); // 5+8+25
    expect(entry.winnerName).toBe("Bot");
  });

  it("does not mutate the original log", () => {
    const log = createEmptyGameLog();
    const players: PlayerState[] = [makePlayer("Alice", { ones: 3 })];
    addGameLogEntry(log, { id: "g1", diceCount: 5, players }, "2026-03-22T10:00:00Z");
    expect(log.entries).toHaveLength(0);
  });

  it("calculates player average score", () => {
    let log = createEmptyGameLog();
    // Game 1: Alice scores 30
    log = addGameLogEntry(log, {
      id: "g1", diceCount: 5,
      players: [makePlayer("Alice", { ones: 5, twos: 10, threes: 15 })],
    }, "2026-03-22T10:00:00Z");
    // Game 2: Alice scores 60
    log = addGameLogEntry(log, {
      id: "g2", diceCount: 5,
      players: [makePlayer("Alice", { ones: 10, twos: 20, threes: 30 })],
    }, "2026-03-22T11:00:00Z");

    expect(getPlayerAverageScore(log, "Alice", 5)).toBe(45); // (30+60)/2
  });

  it("returns 0 for unknown player average", () => {
    const log = createEmptyGameLog();
    expect(getPlayerAverageScore(log, "Nobody", 5)).toBe(0);
  });

  it("counts player games per dice count", () => {
    let log = createEmptyGameLog();
    log = addGameLogEntry(log, {
      id: "g1", diceCount: 5,
      players: [makePlayer("Alice", { ones: 3 })],
    }, "2026-03-22T10:00:00Z");
    log = addGameLogEntry(log, {
      id: "g2", diceCount: 6,
      players: [makePlayer("Alice", { ones: 3 })],
    }, "2026-03-22T11:00:00Z");

    expect(getPlayerGameCount(log, "Alice", 5)).toBe(1);
    expect(getPlayerGameCount(log, "Alice", 6)).toBe(1);
    expect(getPlayerGameCount(log, "Alice", 8)).toBe(0);
  });
});

describe("High Scores", () => {
  it("ranks multiple new players against only their mode and preserves insertion ranks", () => {
    let board = createEmptyHighScores();
    for (let i = 0; i < 10; i++) {
      board = updateHighScores(board, { id: `five-${i}`, diceCount: 5, players: [makePlayer(`F${i}`, { chance: 10 + i })] });
      board = updateHighScores(board, { id: `six-${i}`, diceCount: 6, players: [makePlayer(`S${i}`, { chance: 26 + i })] });
    }
    const oldSix = getHighScoresForDiceCount(board, 6);
    board = updateHighScores(board, { id: "new", diceCount: 5, players: [makePlayer("First", { chance: 30 }), makePlayer("Second", { chance: 25 }), makePlayer("Low", { chance: 5 })] });
    const five = getHighScoresForDiceCount({ entries: [...board.entries].reverse() }, 5);
    expect(five.map((row) => row.score)).toEqual([30, 25, 19, 18, 17, 16, 15, 14, 13, 12]);
    expect(five.map((row) => row.rankCurrent)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(five.slice(0, 2).map((row) => row.rankOriginal)).toEqual([1, 2]);
    expect(getHighScoresForDiceCount(board, 6)).toEqual(oldSix);
  });
  it("starts empty", () => {
    const hs = createEmptyHighScores();
    expect(hs.entries).toHaveLength(0);
  });

  it("adds high score entries for all players in a game", () => {
    const hs = createEmptyHighScores();
    const players: PlayerState[] = [
      makePlayer("Alice", { ones: 5, twos: 10, chance: 20 }),
      makePlayer("Bot", { ones: 3, twos: 6, chance: 15 }, true),
    ];
    const updated = updateHighScores(hs, { id: "g1", diceCount: 5, players });

    const scores = getHighScoresForDiceCount(updated, 5);
    expect(scores).toHaveLength(2);
    expect(scores[0].playerName).toBe("Alice");
    expect(scores[0].score).toBe(35);
    expect(scores[0].rankCurrent).toBe(1);
    expect(scores[0].isAi).toBe(false);
    expect(scores[1].playerName).toBe("Bot");
    expect(scores[1].score).toBe(24);
    expect(scores[1].rankCurrent).toBe(2);
    expect(scores[1].isAi).toBe(true);
  });

  it("preserves rankOriginal when new scores push it down", () => {
    let hs = createEmptyHighScores();
    // First game: Alice gets 20
    hs = updateHighScores(hs, {
      id: "g1", diceCount: 5,
      players: [makePlayer("Alice", { ones: 5, twos: 10, chance: 5 })],
    });
    const firstScores = getHighScoresForDiceCount(hs, 5);
    expect(firstScores[0].rankOriginal).toBe(1);

    // Second game: Bob gets 50, pushing Alice down
    hs = updateHighScores(hs, {
      id: "g2", diceCount: 5,
      players: [makePlayer("Bob", { ones: 5, twos: 10, chance: 35 })],
    });
    const scores = getHighScoresForDiceCount(hs, 5);
    expect(scores[0].playerName).toBe("Bob");
    expect(scores[0].rankCurrent).toBe(1);
    expect(scores[1].playerName).toBe("Alice");
    expect(scores[1].rankCurrent).toBe(2);
    // Alice's original rank should still be 1
    expect(scores[1].rankOriginal).toBe(1);
  });

  it("keeps separate leaderboards per dice count", () => {
    let hs = createEmptyHighScores();
    hs = updateHighScores(hs, {
      id: "g1", diceCount: 5,
      players: [makePlayer("Alice", { ones: 5 })],
    });
    hs = updateHighScores(hs, {
      id: "g2", diceCount: 6,
      players: [makePlayer("Bob", { ones: 10 })],
    });

    expect(getHighScoresForDiceCount(hs, 5)).toHaveLength(1);
    expect(getHighScoresForDiceCount(hs, 6)).toHaveLength(1);
    expect(getHighScoresForDiceCount(hs, 5)[0].playerName).toBe("Alice");
    expect(getHighScoresForDiceCount(hs, 6)[0].playerName).toBe("Bob");
  });

  it("limits to top 10 per dice count", () => {
    let hs = createEmptyHighScores();
    for (let i = 0; i < 12; i++) {
      hs = updateHighScores(hs, {
        id: `g${i}`, diceCount: 5,
        players: [makePlayer(`P${i}`, { chance: i * 10 })],
      });
    }
    const scores = getHighScoresForDiceCount(hs, 5);
    expect(scores).toHaveLength(10);
    // Highest score should be first (P11 = 110)
    expect(scores[0].playerName).toBe("P11");
    expect(scores[0].score).toBe(110);
  });

  it("links gameId back to the game", () => {
    const hs = createEmptyHighScores();
    const updated = updateHighScores(hs, {
      id: "my-game-123", diceCount: 5,
      players: [makePlayer("Alice", { ones: 5 })],
    });
    expect(getHighScoresForDiceCount(updated, 5)[0].gameId).toBe("my-game-123");
  });

  it("handles tied scores correctly", () => {
    let hs = createEmptyHighScores();
    hs = updateHighScores(hs, {
      id: "g1", diceCount: 5,
      players: [makePlayer("Alice", { chance: 25 })],
    });
    hs = updateHighScores(hs, {
      id: "g2", diceCount: 5,
      players: [makePlayer("Bob", { chance: 25 })],
    });
    const scores = getHighScoresForDiceCount(hs, 5);
    expect(scores).toHaveLength(2);
    // Both have same score
    expect(scores[0].score).toBe(25);
    expect(scores[1].score).toBe(25);
    expect(scores.map((row) => [row.playerName, row.rankOriginal, row.rankCurrent])).toEqual([["Alice", 1, 1], ["Bob", 1, 2]]);
  });

  it("does not qualify when score equals the 10th place (strict >)", () => {
    let hs = createEmptyHighScores();
    // Fill 10 slots with score 50
    for (let i = 0; i < 10; i++) {
      hs = updateHighScores(hs, {
        id: `g${i}`, diceCount: 5,
        players: [makePlayer(`P${i}`, { chance: 50 })],
      });
    }
    // New player ties the lowest (50) — should NOT qualify (strict >)
    hs = updateHighScores(hs, {
      id: "g-tie", diceCount: 5,
      players: [makePlayer("Loser", { chance: 50 })],
    });
    const scores = getHighScoresForDiceCount(hs, 5);
    expect(scores).toHaveLength(10);
    expect(scores.every((s) => s.playerName !== "Loser")).toBe(true);
  });

  it("does not mutate original high scores", () => {
    const hs = createEmptyHighScores();
    updateHighScores(hs, {
      id: "g1", diceCount: 5,
      players: [makePlayer("Alice", { ones: 5 })],
    });
    expect(hs.entries).toHaveLength(0);
  });
});
