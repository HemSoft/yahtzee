import { describe, expect, test } from "bun:test";
import {
  createGame,
  calculateTotal,
  isGameComplete,
  getAvailableCategories,
} from "../src/game";
import { CATEGORIES } from "../src/scoring";

describe("createGame", () => {
  test("initializes with correct dice count", () => {
    const game = createGame({
      id: "test-1",
      diceCount: 5,
      players: [{ id: "p1", name: "Alice" }],
    });
    expect(game.diceCount).toBe(5);
    expect(game.dice).toHaveLength(5);
    expect(game.status).toBe("lobby");
    expect(game.rollsLeft).toBe(3);
  });

  test("supports 6-dice variant", () => {
    const game = createGame({
      id: "test-2",
      diceCount: 6,
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
    });
    expect(game.diceCount).toBe(6);
    expect(game.dice).toHaveLength(6);
    expect(game.players).toHaveLength(2);
  });

  test("supports N-dice variant", () => {
    const game = createGame({
      id: "test-3",
      diceCount: 10,
      players: [{ id: "p1", name: "Alice" }],
    });
    expect(game.diceCount).toBe(10);
    expect(game.dice).toHaveLength(10);
  });
});

describe("calculateTotal", () => {
  test("calculates upper bonus when threshold met", () => {
    const player = {
      id: "p1",
      name: "Alice",
      scores: {
        ones: 3,
        twos: 6,
        threes: 9,
        fours: 12,
        fives: 15,
        sixes: 18,
      } as Record<string, number>,
    };
    const totals = calculateTotal(player);
    expect(totals.upperSubtotal).toBe(63);
    expect(totals.upperBonus).toBe(35);
  });

  test("no bonus below threshold", () => {
    const player = {
      id: "p1",
      name: "Alice",
      scores: {
        ones: 1,
        twos: 2,
      } as Record<string, number>,
    };
    const totals = calculateTotal(player);
    expect(totals.upperSubtotal).toBe(3);
    expect(totals.upperBonus).toBe(0);
  });

  test("includes lower section scores", () => {
    const player = {
      id: "p1",
      name: "Bob",
      scores: {
        yahtzee: 50,
        chance: 22,
      } as Record<string, number>,
    };
    const totals = calculateTotal(player);
    expect(totals.lowerSubtotal).toBe(72);
    expect(totals.grandTotal).toBe(72);
  });
});

describe("isGameComplete", () => {
  test("returns false when categories remain", () => {
    const game = createGame({
      id: "t",
      diceCount: 5,
      players: [{ id: "p1", name: "A" }],
    });
    expect(isGameComplete(game)).toBe(false);
  });

  test("returns true when all scored", () => {
    const game = createGame({
      id: "t",
      diceCount: 5,
      players: [{ id: "p1", name: "A" }],
    });
    for (const cat of CATEGORIES) {
      game.players[0].scores[cat.id] = 10;
    }
    expect(isGameComplete(game)).toBe(true);
  });
});

describe("getAvailableCategories", () => {
  test("returns all 15 at start", () => {
    const player = { id: "p1", name: "A", scores: {} };
    expect(getAvailableCategories(player)).toHaveLength(15);
  });

  test("excludes scored categories", () => {
    const player = { id: "p1", name: "A", scores: { ones: 3, yahtzee: 50 } };
    const available = getAvailableCategories(player);
    expect(available).not.toContain("ones");
    expect(available).not.toContain("yahtzee");
    expect(available).toHaveLength(13);
  });
});
