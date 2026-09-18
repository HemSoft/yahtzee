import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import { recordScore, type ScoreSubmission } from "../../../convex/lib/recordScore";
import type { MutationCtx } from "../../../convex/_generated/server";

type Row = Record<string, string | number | boolean>;
function fixture() {
  const tables: Record<string, Row[]> = { highScores: [], highScoreReceipts: [] };
  let sequence = 0;
  const db = {
    query(table: string) {
      const filters: [string, unknown][] = [];
      const index = { eq(key: string, value: unknown) { filters.push([key, value]); return index; } };
      const rows = () => tables[table].filter((r) => filters.every(([k, v]) => r[k] === v));
      const query = {
        withIndex(_name: string, build: (q: typeof index) => unknown) { build(index); return query; },
        order(_direction: string) { return query; },
        unique: async () => {
          if (rows().length > 1) throw new Error("Duplicate receipt");
          return rows()[0] ?? null;
        },
        take: async (n: number) => rows().sort((a, b) => Number(b.score) - Number(a.score)).slice(0, n),
      };
      return query;
    },
    async insert(table: string, row: Row) { tables[table].push({ ...row, _id: String(sequence++) }); },
    async delete(id: string) { tables.highScores = tables.highScores.filter((r) => r._id !== id); },
  };
  return { ctx: { db } as unknown as MutationCtx, tables };
}
const result = (gameId = "game", score = 100): ScoreSubmission => ({
  gameId, score, diceCount: 5, playerName: "Player", isAi: false, dateRecorded: "2026-01-01T00:00:00Z",
});

describe("backend high-score receipts", () => {
  test("invalid numeric scores cannot evict results or consume a receipt", async () => {
    const { ctx, tables } = fixture();
    for (let i = 0; i < 10; i++) await recordScore(ctx, result(String(i)));
    const before = JSON.stringify(tables);
    for (const score of [NaN, Infinity, -Infinity, -1, 1.5]) {
      await expect(recordScore(ctx, result("invalid", score))).rejects.toThrow("finite nonnegative integer");
    }
    expect(JSON.stringify(tables)).toBe(before);
  });
  test("concurrent public mutations persist a single result", async () => {
    const t = convexTest(schema, {
      "../../../convex/_generated/server.ts": () => import("../../../convex/_generated/server"),
      "../../../convex/highScores.ts": () => import("../../../convex/highScores"),
    });
    await Promise.all(Array.from({ length: 8 }, () => t.mutation(api.highScores.submit, result())));
    const rows = await t.query(api.highScores.top, { diceCount: 5 });
    expect(rows).toHaveLength(1);
    expect(rows[0].rankCurrent).toBe(1);
  });
  test("corrupt duplicate receipts fail instead of hiding the invariant violation", async () => {
    const { ctx, tables } = fixture();
    tables.highScoreReceipts.push({ ...result() }, { ...result() });
    await expect(recordScore(ctx, result())).rejects.toThrow("Duplicate receipt");
    expect(tables.highScores).toHaveLength(0);
  });
  test("replaying a game/player result inserts once", async () => {
    const { ctx, tables } = fixture();
    await recordScore(ctx, result()); await recordScore(ctx, result());
    expect(tables.highScores).toHaveLength(1);
    expect(tables.highScoreReceipts).toHaveLength(1);
  });
  test("same name in different games and other players remain distinct", async () => {
    const { ctx, tables } = fixture();
    await recordScore(ctx, result());
    await recordScore(ctx, result("other"));
    await recordScore(ctx, { ...result(), playerName: "Other" });
    await recordScore(ctx, { ...result(), isAi: true });
    await recordScore(ctx, { ...result(), diceCount: 6 });
    expect(tables.highScores).toHaveLength(5);
  });
  test("a replay cannot change a score or displace a distinct top-ten result", async () => {
    const { ctx, tables } = fixture();
    for (let i = 0; i < 10; i++) await recordScore(ctx, result(String(i), 100 + i));
    const original = JSON.stringify(tables.highScores);
    await recordScore(ctx, result("0", 999));
    expect(JSON.stringify(tables.highScores)).toBe(original);
  });
  test("retains the receipt after an entry is evicted", async () => {
    const { ctx, tables } = fixture();
    await recordScore(ctx, result());
    for (let i = 0; i < 10; i++) await recordScore(ctx, result(String(i), 200));
    await recordScore(ctx, result("game", 999));
    expect(tables.highScores).toHaveLength(10);
    expect(tables.highScores.some((r) => r.gameId === "game")).toBe(false);
  });
  test("records non-qualifying results and preserves ties at the cutoff", async () => {
    const { ctx, tables } = fixture();
    for (let i = 0; i < 10; i++) await recordScore(ctx, result(String(i)));
    await recordScore(ctx, result("tie")); await recordScore(ctx, result("tie", 999));
    expect(tables.highScores).toHaveLength(10);
    expect(tables.highScoreReceipts).toHaveLength(11);
    expect(tables.highScores.some((r) => r.gameId === "tie")).toBe(false);
  });
  test("recognizes a legacy leaderboard entry without a receipt", async () => {
    const { ctx, tables } = fixture();
    tables.highScores.push({ ...result(), _id: "legacy" });
    await recordScore(ctx, result());
    expect(tables.highScores).toHaveLength(1);
    expect(tables.highScoreReceipts).toHaveLength(1);
  });
});
