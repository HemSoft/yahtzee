/** Roll a single die (1–6). */
export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** Roll `count` dice, returning an array of values. */
export function rollDice(count: number): number[] {
  return Array.from({ length: count }, rollDie);
}

/**
 * Re-roll: keep dice at `heldIndices`, re-roll the rest.
 * Returns a new array with the same length as `current`.
 */
export function reroll(current: number[], heldIndices: Set<number>): number[] {
  return current.map((value, i) => (heldIndices.has(i) ? value : rollDie()));
}
