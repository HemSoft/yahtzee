import { describe, expect, test } from "bun:test";
import type { MutantResult, MutationTestResult } from "mutation-testing-report-schema";
import { mutationGate } from "../../../scripts/mutation/report";

function report(statuses: MutantResult["status"][]): MutationTestResult {
  return {
    schemaVersion: "1.0",
    thresholds: { high: 98, low: 95 },
    files: {
      "rules.ts": {
        source: "export const n = 1;",
        mutants: statuses.map((status, id) => ({
          id: String(id), status, mutatorName: status === "Ignored" ? "StringLiteral" : "ArithmeticOperator", replacement: "0",
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
        })),
      },
    },
  };
}

describe("mutation report gate", () => {
  test("uses valid mutants as the denominator and applies the numeric threshold", () => {
    const data = report(["Killed", "Timeout", "Survived", "CompileError", "Ignored"]);
    const result = mutationGate(data, 67, ["rules.ts"]);
    expect(result.metrics.totalDetected).toBe(2);
    expect(result.metrics.totalValid).toBe(3);
    expect(result.metrics.compileErrors).toBe(1);
    expect(result.metrics.ignored).toBe(1);
    expect(result.metrics.mutationScore).toBeCloseTo(200 / 3);
    expect(result.passed).toBe(false);
    expect(mutationGate(data, 66).passed).toBe(true);
    expect(result.survivors).toHaveLength(1);
    expect(mutationGate(report([...Array<MutantResult["status"]>(19).fill("Killed"), "Survived"]), 95).passed).toBe(true);
  });
  test("rejects empty, incomplete and runtime-error runs instead of inflating their scores", () => {
    for (const statuses of [[], ["CompileError"], ["Killed", "Pending"], ["Killed", "RuntimeError"]] as MutantResult["status"][][]) {
      expect(() => mutationGate(report(statuses), 95)).toThrow();
    }
    expect(() => mutationGate(report(["Killed"]), 95, ["missing.ts"])).toThrow("scope");
    expect(() => mutationGate(report(["Killed"]), NaN)).toThrow("threshold");
  });
  test("rejects undeclared mutant suppressions", () => {
    const data = report(["Ignored", "Killed"]);
    data.files["rules.ts"].mutants[0].mutatorName = "BlockStatement";
    expect(() => mutationGate(data, 95)).toThrow("Undeclared suppression");
  });
});
