import { describe, expect, test } from "bun:test";
import { pickAiCategory, type PlayerState } from "../src/game";
import { getCategories, type CategoryId } from "../src/scoring";

function playerWithOpen(diceCount: number, ...open: CategoryId[]): PlayerState {
  return {
    id: "p", name: "Player",
    scores: Object.fromEntries(getCategories(diceCount)
      .filter((category) => !open.includes(category.id))
      .map((category) => [category.id, 0])),
  };
}

describe("score suggestions", () => {
  test("saves Chance for later when a triple is available in every dice mode", () => {
    for (const count of [5, 6, 8, 10, 20]) {
      const dice = [3, 3, 3, ...Array<number>(count - 3).fill(6)];
      const player = playerWithOpen(count, "three-of-a-kind", "chance");
      expect(pickAiCategory(dice, player, count)).toBe("three-of-a-kind");
    }
  });

  test("preserves Chance for a made combination even with low matching faces", () => {
    const player = { id: "p", name: "Player", scores: {} };
    expect(pickAiCategory([1, 1, 1, 2, 4, 6], player, 6)).toBe("three-of-a-kind");
  });

  test("prefers an upper score at bonus pace over a larger Chance score", () => {
    const player = playerWithOpen(8, "fours", "chance");
    expect(pickAiCategory([4, 4, 4, 4, 1, 2, 5, 6], player, 8)).toBe("fours");
  });

  test("does not waste a weak upper score merely to avoid Chance", () => {
    const player = playerWithOpen(5, "ones", "chance");
    expect(pickAiCategory([1, 2, 3, 4, 5], player, 5)).toBe("chance");
  });

  test("takes Chance rather than scratching an unmade combination", () => {
    const player = playerWithOpen(5, "yahtzee", "chance");
    expect(pickAiCategory([1, 2, 3, 4, 5], player, 5)).toBe("chance");
  });

  test("counts a newly secured bonus when comparing scores", () => {
    const player = playerWithOpen(5, "ones", "small-straight", "chance");
    Object.assign(player.scores, { twos: 8, threes: 9, fours: 12, fives: 15, sixes: 18 });
    expect(pickAiCategory([1, 2, 3, 4, 5], player, 5)).toBe("ones");
  });

  test("does not count an already earned bonus again", () => {
    const player = playerWithOpen(5, "ones", "small-straight", "chance");
    Object.assign(player.scores, { twos: 10, threes: 9, fours: 12, fives: 15, sixes: 18 });
    expect(pickAiCategory([1, 2, 3, 4, 5], player, 5)).toBe("small-straight");
  });

  test("falls back to a weak positive score after Chance has been used", () => {
    const player = playerWithOpen(5, "ones", "yahtzee");
    expect(pickAiCategory([1, 2, 3, 4, 5], player, 5)).toBe("ones");
  });

  test("still selects an available scratch when all remaining scores are zero", () => {
    const player = playerWithOpen(5, "one-pair", "yahtzee");
    expect(pickAiCategory([1, 2, 3, 4, 5], player, 5)).toBe("one-pair");
  });
});
