import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api, internal } from "../../../convex/_generated/api";
import { calculateTotal } from "../src/game";
import { getCategories } from "../src/scoring";

function backend() {
  return convexTest(schema, {
    "../../../convex/_generated/server.ts": () => import("../../../convex/_generated/server"),
    "../../../convex/gameSessions.ts": () => import("../../../convex/gameSessions"),
    "../../../convex/games.ts": () => import("../../../convex/games"),
    "../../../convex/gameLogs.ts": () => import("../../../convex/gameLogs"),
    "../../../convex/highScores.ts": () => import("../../../convex/highScores"),
  });
}
const startOptions = { name: "Guest", diceCount: 5 as const, aiOpponents: 0 };

describe("server-owned guest games", () => {
  test("old forged score/log payloads reject without any result writes", async () => {
    const t = backend();
    await expect(t.mutation(api.highScores.submit, { diceCount: 5, score: 999999, playerName: "Someone else", isAi: false, gameId: "unverified-game", dateRecorded: "invalid-date" })).rejects.toThrow("disabled");
    await expect(t.mutation(api.gameLogs.add, { diceCount: -5, durationSeconds: -1, players: [], gameId: "forged", startedAt: "bad", completedAt: "bad", winnerName: "nobody" })).rejects.toThrow("disabled");
    expect(await t.query(api.highScores.top, { diceCount: 5 })).toHaveLength(0);
    expect(await t.query(api.gameLogs.list, {})).toHaveLength(0);
  });

  test("invalid modes, names and player counts cannot create state", async () => {
    const t = backend();
    for (const options of [
      { ...startOptions, diceCount: -5 }, { ...startOptions, diceCount: 5.5 }, { ...startOptions, diceCount: 21 },
      { ...startOptions, name: " " }, { ...startOptions, name: "x".repeat(33) },
      { ...startOptions, name: "bad\nname" }, { ...startOptions, aiOpponents: -1 },
      { ...startOptions, aiOpponents: 4 }, { ...startOptions, aiOpponents: 0.5 },
    ]) await expect(t.action(api.gameSessions.start, options as never)).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("games").take(100))).toHaveLength(0);
  });

  test("missing, wrong and cross-game capabilities cannot read or change state", async () => {
    const t = backend();
    const a = await t.action(api.gameSessions.start, startOptions);
    const b = await t.action(api.gameSessions.start, startOptions);
    for (const secret of ["", "f".repeat(64), b.secret]) {
      await expect(t.query(api.games.read, { gameId: a.gameId, secret })).rejects.toThrow("Unauthorized");
      await expect(t.mutation(api.games.move, { gameId: a.gameId, secret, revision: 0, move: { kind: "roll" } })).rejects.toThrow("Unauthorized");
    }
    const read = await t.query(api.games.read, { gameId: a.gameId, secret: a.secret });
    expect(read.revision).toBe(0);
    expect("tokenHash" in read).toBe(false);
    const stored = await t.run((ctx) => ctx.db.get(a.gameId));
    expect(stored?.tokenHash).not.toBe(a.secret);
  });

  test("move payloads cannot supply scores, dice or completion metadata", async () => {
    const t = backend(); const initial = await t.action(api.gameSessions.start, startOptions);
    const credentials = { gameId: initial.gameId, secret: initial.secret, revision: 0 };
    for (const forged of [
      { ...credentials, move: { kind: "score", category: "chance", score: 999999 } },
      { ...credentials, move: { kind: "roll" }, game: { dice: [6, 6, 6, 6, 6], status: "finished" } },
      { ...credentials, move: { kind: "score", category: "chance" }, completedAt: "forged" },
    ]) await expect(t.mutation(api.games.move, forged as never)).rejects.toThrow();
    expect((await t.query(api.games.read, { gameId: initial.gameId, secret: initial.secret })).revision).toBe(0);
    expect(await t.query(api.gameLogs.list, {})).toHaveLength(0);
  });

  test("roll/hold rules, unavailable categories and revisions reject illegal choices", async () => {
    const t = backend(); const initial = await t.action(api.gameSessions.start, startOptions);
    const credentials = { gameId: initial.gameId, secret: initial.secret };
    let current = await t.mutation(api.games.move, { ...credentials, revision: 0, move: { kind: "hold", index: 0 } });
    const held = current.game.dice[0];
    for (let i = 0; i < 2; i++) current = await t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "roll" } });
    expect(current.game.dice[0]).toBe(held); expect(current.game.rollsLeft).toBe(0);
    await expect(t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "roll" } })).rejects.toThrow("No rolls");
    for (const index of [-1, 5, 0.5, NaN, Infinity]) await expect(t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "hold", index } })).rejects.toThrow();
    await expect(t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "score", category: "maxi-yahtzee" } })).rejects.toThrow("unavailable");
    await expect(t.mutation(api.games.move, { ...credentials, revision: 999, move: { kind: "roll" } })).rejects.toThrow("revision");
    const expected = getCategories(5).find((c) => c.id === "chance")!.score(current.game.dice);
    current = await t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "score", category: "chance" } });
    expect(current.game.players[0].scores.chance).toBe(expected);
    await expect(t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "score", category: "chance" } })).rejects.toThrow("unavailable");
    const replay = await t.mutation(api.games.move, { ...credentials, revision: 0, move: { kind: "hold", index: 0 } });
    expect(replay).toEqual(current);
  });

  for (const diceCount of [2, 5, 6, 8, 10, 20] as const) {
    test(`${diceCount}-dice human/AI game persists computed results once under concurrent completion`, async () => {
      const t = backend();
      const initial = await t.action(api.gameSessions.start, { ...startOptions, diceCount, aiOpponents: 3 });
      const credentials = { gameId: initial.gameId, secret: initial.secret };
      let current = { gameId: initial.gameId, revision: initial.revision, game: initial.game };
      const categories = getCategories(diceCount);
      for (const category of categories.slice(0, -1)) {
        const expected = category.score(current.game.dice);
        current = await t.mutation(api.games.move, { ...credentials, revision: current.revision, move: { kind: "score", category: category.id } });
        expect(current.game.players[0].scores[category.id]).toBe(expected);
      }
      expect(await t.query(api.gameLogs.list, {})).toHaveLength(0);
      const last = { ...credentials, revision: current.revision, move: { kind: "score" as const, category: categories.at(-1)!.id } };
      const completions = await Promise.all(Array.from({ length: 8 }, () => t.mutation(api.games.move, last)));
      expect(completions.every((entry) => entry.game.status === "finished")).toBe(true);
      const logs = await t.query(api.gameLogs.list, { diceCount });
      expect(logs).toHaveLength(1); expect(logs[0].verified).toBe(true);
      expect(logs[0].players).toHaveLength(4); expect(logs[0].durationSeconds).toBeGreaterThanOrEqual(0);
      for (const [index, player] of completions[0].game.players.entries()) {
        expect(logs[0].players[index].score).toBe(calculateTotal(player, diceCount).grandTotal);
        expect(Object.keys(player.scores)).toHaveLength(categories.length);
      }
      expect(await t.query(api.highScores.top, { diceCount })).toHaveLength(4);
      expect(await t.run((ctx) => ctx.db.query("highScoreReceipts").take(100))).toHaveLength(4);
      await expect(t.mutation(api.games.move, { ...credentials, revision: completions[0].revision, move: { kind: "roll" } })).rejects.toThrow("Not a human turn");
      await t.run((ctx) => ctx.db.patch(initial.gameId, { expiresAt: Date.now() - 1 }));
      await expect(t.query(api.games.read, credentials)).rejects.toThrow("expired");
      await expect(t.mutation(api.games.move, last)).rejects.toThrow("expired");
      await t.mutation(internal.games.expire, { gameId: initial.gameId });
      expect(await t.run((ctx) => ctx.db.get(initial.gameId))).toBeNull();
      expect(await t.query(api.gameLogs.list, {})).toHaveLength(1);
      expect(await t.query(api.highScores.top, { diceCount })).toHaveLength(4);
    });
  }

  test("unverified historical results stay stored but cannot appear as trusted rankings", async () => {
    const t = backend();
    await t.run((ctx) => ctx.db.insert("highScores", { gameId: "old", score: 999999, diceCount: 5, playerName: "Unverified", isAi: false, dateRecorded: "bad" }));
    expect(await t.query(api.highScores.top, { diceCount: 5 })).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("highScores").take(100))).toHaveLength(1);
    await t.run((ctx) => ctx.db.insert("gameLogs", { gameId: "old", diceCount: 5, startedAt: "bad", completedAt: "bad", durationSeconds: -1, players: [], winnerName: "Unverified" }));
    expect(await t.query(api.gameLogs.list, {})).toHaveLength(0);
    expect(await t.query(api.gameLogs.list, { diceCount: 5 })).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("gameLogs").take(100))).toHaveLength(1);
  });
});
