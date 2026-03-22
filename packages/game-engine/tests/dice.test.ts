import { describe, expect, test } from "bun:test";
import { rollDie, rollDice, reroll } from "../src/dice";

describe("rollDie", () => {
  test("returns values between 1 and 6", () => {
    for (let i = 0; i < 100; i++) {
      const val = rollDie();
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
    }
  });
});

describe("rollDice", () => {
  test("returns correct number of dice for 5", () => {
    expect(rollDice(5)).toHaveLength(5);
  });

  test("returns correct number of dice for 6", () => {
    expect(rollDice(6)).toHaveLength(6);
  });

  test("returns correct number for N=10", () => {
    expect(rollDice(10)).toHaveLength(10);
  });

  test("all values in range", () => {
    const dice = rollDice(20);
    for (const d of dice) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });
});

describe("reroll", () => {
  test("keeps held dice unchanged", () => {
    const current = [3, 5, 2, 6, 1];
    const held = new Set([1, 3]); // hold indices 1 and 3
    const result = reroll(current, held);

    expect(result[1]).toBe(5);
    expect(result[3]).toBe(6);
    expect(result).toHaveLength(5);
  });

  test("preserves array length", () => {
    const current = [1, 2, 3, 4, 5, 6];
    const result = reroll(current, new Set([0, 2, 4]));
    expect(result).toHaveLength(6);
  });

  test("holding all returns same values", () => {
    const current = [4, 4, 4, 4, 4];
    const held = new Set([0, 1, 2, 3, 4]);
    const result = reroll(current, held);
    expect(result).toEqual(current);
  });
});
