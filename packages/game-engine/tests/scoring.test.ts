import { describe, expect, test } from "bun:test";
import {
  upperScore,
  threeOfAKind,
  fourOfAKind,
  fullHouse,
  smallStraight,
  largeStraight,
  yahtzee,
  chance,
} from "../src/scoring";

describe("upperScore", () => {
  test("counts ones", () => {
    expect(upperScore([1, 1, 3, 4, 5], 1)).toBe(2);
  });

  test("counts fives", () => {
    expect(upperScore([5, 5, 5, 2, 1], 5)).toBe(15);
  });

  test("returns 0 when face absent", () => {
    expect(upperScore([2, 3, 4, 5, 6], 1)).toBe(0);
  });

  test("works with 6 dice", () => {
    expect(upperScore([3, 3, 3, 3, 1, 2], 3)).toBe(12);
  });
});

describe("threeOfAKind", () => {
  test("scores sum when valid", () => {
    expect(threeOfAKind([3, 3, 3, 1, 2])).toBe(12);
  });

  test("scores 0 when no three of a kind", () => {
    expect(threeOfAKind([1, 2, 3, 4, 5])).toBe(0);
  });

  test("works with four of a kind too", () => {
    expect(threeOfAKind([6, 6, 6, 6, 1])).toBe(25);
  });
});

describe("fourOfAKind", () => {
  test("scores sum when valid", () => {
    expect(fourOfAKind([4, 4, 4, 4, 2])).toBe(18);
  });

  test("scores 0 when only three", () => {
    expect(fourOfAKind([3, 3, 3, 1, 2])).toBe(0);
  });
});

describe("fullHouse", () => {
  test("scores 25 for 2+3", () => {
    expect(fullHouse([2, 2, 5, 5, 5])).toBe(25);
  });

  test("scores 0 for non-full-house", () => {
    expect(fullHouse([1, 2, 3, 4, 5])).toBe(0);
  });

  test("scores 0 for four-of-a-kind", () => {
    expect(fullHouse([3, 3, 3, 3, 1])).toBe(0);
  });
});

describe("smallStraight", () => {
  test("scores 30 for 1-2-3-4", () => {
    expect(smallStraight([1, 2, 3, 4, 6])).toBe(30);
  });

  test("scores 30 for 2-3-4-5", () => {
    expect(smallStraight([2, 3, 4, 5, 5])).toBe(30);
  });

  test("scores 30 for 3-4-5-6", () => {
    expect(smallStraight([1, 3, 4, 5, 6])).toBe(30);
  });

  test("scores 0 when no run of 4", () => {
    expect(smallStraight([1, 2, 4, 5, 6])).toBe(0);
  });
});

describe("largeStraight", () => {
  test("scores 40 for 1-2-3-4-5", () => {
    expect(largeStraight([1, 2, 3, 4, 5])).toBe(40);
  });

  test("scores 40 for 2-3-4-5-6", () => {
    expect(largeStraight([2, 3, 4, 5, 6])).toBe(40);
  });

  test("scores 0 for small straight only", () => {
    expect(largeStraight([1, 2, 3, 4, 4])).toBe(0);
  });
});

describe("yahtzee", () => {
  test("scores 50 for five of a kind", () => {
    expect(yahtzee([4, 4, 4, 4, 4])).toBe(50);
  });

  test("scores 0 for non-yahtzee", () => {
    expect(yahtzee([4, 4, 4, 4, 3])).toBe(0);
  });

  test("scores 50 for six of a kind (6-dice)", () => {
    expect(yahtzee([2, 2, 2, 2, 2, 2])).toBe(50);
  });
});

describe("chance", () => {
  test("sums all dice", () => {
    expect(chance([1, 2, 3, 4, 5])).toBe(15);
  });

  test("sums 6 dice", () => {
    expect(chance([6, 6, 6, 6, 6, 6])).toBe(36);
  });
});
