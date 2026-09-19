import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { CoverageMapData } from "istanbul-lib-coverage";
import { instrument } from "../../../scripts/quality/instrument";
import { crap, measureFunctions, regressions } from "../../../scripts/quality/metrics";
import { productionSources, projectRoot, sourceKey } from "../../../scripts/quality/sources";

const path = resolve(projectRoot, "tests/risk-fixture.ts"); const key = sourceKey(path);
function measure(source: string, calls = "") {
  const { code, coverage } = instrument(source, path);
  if (!calls) return measureFunctions(key, source, coverage);
  const context: { __coverage__?: CoverageMapData } = {};
  runInNewContext(new Bun.Transpiler({ loader: "ts" }).transformSync(code) + calls, context);
  return measureFunctions(key, source, context.__coverage__![key]);
}
describe("production risk measurement", () => {
  test("uses the CRAP formula and branch/function-entry coverage explicitly", () => {
    expect(crap(6, 0)).toBe(42); expect(crap(6, 1)).toBe(6); expect(crap(6, 0.5)).toBe(10.5);
    const rows = measure("function plain(){return 1} function choice(x:boolean){return x?1:0}", ";plain();choice(true);");
    expect(rows[0].coverageBasis).toBe("function-entry"); expect(rows[0].coverage).toBe(1);
    expect(rows[1].coverageBasis).toBe("branch"); expect(rows[1].coverage).toBe(0.5);
    expect(rows[1].crap).toBe(2.5);
  });
  test("nested functions own their decisions; defaults, logical tests and loops count", () => {
    const rows = measure("function outer(x=1){const inner=()=>x?1:0;if(x&&x>1)return inner();return 0}");
    expect(rows.map((row) => row.complexity)).toEqual([4, 2]);
    expect(measure("function loops(a:number[]){for(const x of a){if(x)continue}try{while(a.length)a.pop()}catch{return 0}}")[0].complexity).toBe(5);
    expect(rows.every((row) => !row.entered && row.coverage === 0)).toBe(true);
    expect(regressions(rows, {})).toEqual([]);
  });
  test("an uncovered branch lowers coverage, raises CRAP and fails a legacy budget", () => {
    function source(depth: number) {
      return `function guarded(value:number){${Array.from({ length: depth }, (_, n) => `if(value>${n}){`).join("")}return 1;${"}".repeat(depth)}return 0}`;
    }
    const before = measure(source(9), ";guarded(0);")[0];
    const after = measure(source(10), ";guarded(0);")[0];
    expect([before.complexity, before.covered, before.total]).toEqual([10, 1, 18]);
    expect([after.complexity, after.covered, after.total]).toEqual([11, 1, 20]);
    const budget = { [before.id]: { maxCrap: before.crap, reason: "Synthetic legacy-risk regression fixture" } };
    expect(before.crap).toBeGreaterThan(30); expect(regressions([before], budget)).toEqual([]);
    expect(after.coverage).toBeLessThan(before.coverage); expect(after.crap).toBeGreaterThan(before.crap);
    expect(regressions([after], budget)[0]).toContain("exceeds");
    expect(regressions([after], {})).toHaveLength(1);
    expect(regressions([], budget)[0]).toContain("obsolete");
    expect(regressions(measure(source(8), ";guarded(0);"), budget)[0]).toContain("lower");
    expect(regressions(measure(source(4)), {})).toEqual([]);
    expect(regressions(measure(source(5)), {})).toHaveLength(1);
  });
  test("inventory includes unimported production and excludes generated, declarations and tests", () => {
    const root = mkdtempSync(join(tmpdir(), "yahtzee-risk-inventory-"));
    try {
      for (const name of ["apps/web/src/unimported.ts", "packages/engine/src/unseen.ts", "convex/unused.ts", "apps/web/src/unseen.js", "convex/_generated/api.ts", "apps/web/src/env.d.ts", "packages/engine/tests/example.test.ts"]) {
        const file = resolve(root, name); mkdirSync(resolve(file, ".."), { recursive: true }); writeFileSync(file, "export function untouched(){return 1}");
      }
      const files = productionSources(root).map((file) => sourceKey(file, root));
      expect(files).toEqual(["apps/web/src/unimported.ts", "apps/web/src/unseen.js", "convex/unused.ts", "packages/engine/src/unseen.ts"]);
      const row = measure("function untouched(){return 1}")[0];
      expect(row.entered).toBe(false); expect(row.coverage).toBe(0); expect(row.crap).toBe(2);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
