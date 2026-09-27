import { describe, expect, test } from "bun:test";
import { createOfflineBackend } from "../src/offline";
import { OFFLINE_RESULTS_KEY, readOfflineResults } from "../src/offlineStorage";
import { getCategories } from "../src/scoring";

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, fail: false, getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.fail) throw new Error("Disk full"); this.data.set(key, value); } };
}

async function play(backend: ReturnType<typeof createOfflineBackend>, diceCount: number, aiOpponents = 0) {
  let state = await backend.start({ name: "Player", diceCount, aiOpponents });
  for (const category of getCategories(diceCount)) {
    state = { ...state, ...await backend.move({ ...state, move: { kind: "score", category: category.id } }) };
  }
  return state;
}

describe("standalone offline games", () => {
  for (const count of [2, 5, 6, 8, 10, 20]) {
    test(`${count} dice: completes human and three AI cards and persists without a server`, async () => {
      const storage = memoryStorage();
      const backend = createOfflineBackend(storage);
      const state = await play(backend, count, 3);
      expect(state.game.status).toBe("finished");
      expect(state.game.players).toHaveLength(4);
      for (const player of state.game.players) expect(Object.keys(player.scores)).toHaveLength(getCategories(count).length);
      const reopened = createOfflineBackend(storage).results();
      expect(reopened.history.entries).toHaveLength(1);
      expect(reopened.highScores.entries).toHaveLength(4);
      expect(reopened.history.entries[0].id).toBe(state.game.id);
      expect(reopened.highScores.entries.every((entry) => entry.diceCount === count)).toBe(true);
    });
  }

  test("holds, rerolls, and retries without mutating previous snapshots", async () => {
    const backend = createOfflineBackend(memoryStorage());
    const first = await backend.start({ name: "Player", diceCount: 6, aiOpponents: 0 });
    const hold = { ...first, move: { kind: "hold" as const, index: 0 } };
    const held = await backend.move(hold);
    expect(first.game.held).toEqual([]);
    expect(held.game.held).toEqual([0]);
    expect(await backend.move(hold)).toEqual(held);
    const rolled = await backend.move({ ...held, secret: first.secret, move: { kind: "roll" } });
    expect(rolled.game.dice[0]).toBe(first.game.dice[0]);
    expect(rolled.game.rollsLeft).toBe(1);
    const last = await backend.move({ ...rolled, secret: first.secret, move: { kind: "roll" } });
    await expect(backend.move({ ...last, secret: first.secret, move: { kind: "roll" } })).rejects.toThrow("No rolls");
  });

  test("failed final persistence is retryable and saves the result exactly once", async () => {
    const storage = memoryStorage();
    const backend = createOfflineBackend(storage);
    let state = await backend.start({ name: "Player", diceCount: 6, aiOpponents: 3 });
    const categories = getCategories(6);
    for (const category of categories.slice(0, -1)) {
      state = { ...state, ...await backend.move({ ...state, move: { kind: "score", category: category.id } }) };
    }
    const final = { ...state, move: { kind: "score" as const, category: categories.at(-1)!.id } };
    storage.fail = true;
    await expect(backend.move(final)).rejects.toThrow("Disk full");
    expect(backend.results().history.entries).toHaveLength(0);
    await expect(backend.move({ ...final, move: { kind: "hold", index: 0 } })).rejects.toThrow("pending");
    storage.fail = false;
    const result = await backend.move(final);
    expect(result.game.status).toBe("finished");
    expect(await backend.move(final)).toEqual(result);
    expect(backend.results().history.entries).toHaveLength(1);
    expect(readOfflineResults(storage).highScores.entries).toHaveLength(4);
  });

  test("rejects invalid options and stale sessions", async () => {
    const backend = createOfflineBackend(memoryStorage());
    await expect(backend.start({ name: " ", diceCount: 6, aiOpponents: 0 })).rejects.toThrow();
    await expect(backend.start({ name: "Player", diceCount: 21, aiOpponents: 0 })).rejects.toThrow();
    await expect(backend.start({ name: "Player", diceCount: 6, aiOpponents: 4 })).rejects.toThrow();
    const old = await backend.start({ name: "Player", diceCount: 6, aiOpponents: 0 });
    const state = await backend.start({ name: "Other", diceCount: 6, aiOpponents: 0 });
    await expect(backend.move({ ...old, move: { kind: "roll" } })).rejects.toThrow("no longer active");
    await expect(backend.move({ ...state, revision: 99, move: { kind: "roll" } })).rejects.toThrow("revision");
    await expect(backend.move({ ...state, move: { kind: "score", category: "bogus" } })).rejects.toThrow("unavailable");
    await expect(backend.move({ ...state, move: { kind: "hold", index: -1 } })).rejects.toThrow("index");
  });

  test("does not overwrite corrupt or unsupported saved scores", async () => {
    for (const raw of ["{broken", "null", "[]", '{"version":2}', '{"version":1,"history":{"entries":[{}]},"highScores":{"entries":[]}}']) {
      const storage = memoryStorage(); storage.data.set(OFFLINE_RESULTS_KEY, raw);
      const backend = createOfflineBackend(storage);
      await expect(backend.start({ name: "Player", diceCount: 6, aiOpponents: 0 })).rejects.toThrow("could not be read");
      expect(storage.getItem(OFFLINE_RESULTS_KEY)).toBe(raw);
    }
  });

  test("fails before play if storage cannot be written", async () => {
    const storage = memoryStorage(); storage.fail = true;
    await expect(createOfflineBackend(storage).start({ name: "Player", diceCount: 6, aiOpponents: 0 })).rejects.toThrow("Disk full");
  });
});
