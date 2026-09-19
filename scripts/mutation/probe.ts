import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { MutationTestResult } from "mutation-testing-report-schema";
import base from "../../stryker.config.json";
import { mutationGate } from "./report";

const root = resolve(import.meta.dir, "../..");
const output = join(root, "reports/mutation-probe");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
const file = "packages/game-engine/src/game.ts";
const original = readFileSync(join(root, file), "utf8");
const expression = "upperTotal >= getUpperBonusThreshold(diceCount)";
if (original.split(expression).length !== 2) throw new Error("Bonus comparison must have one proof anchor");
const line = original.slice(0, original.indexOf(expression)).split(/\r?\n/).length;
const strong = `import { expect, test } from "bun:test";
import { getUpperBonus } from "./packages/game-engine/src/game";
test("bonus comparison sensitivity", () => {
  expect(getUpperBonus(62, 5)).toBe(0);
  expect(getUpperBonus(63, 5)).toBe(35);
  expect(getUpperBonus(64, 5)).toBe(35);
});
`;
const weak = strong.replace("expect(getUpperBonus(63, 5)).toBe(35)", "expect(getUpperBonus(63, 5)).toBeGreaterThanOrEqual(0)");

function removeOwned(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    if (process.platform === "win32") rmdirSync(path);
    else unlinkSync(path);
  } else if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) removeOwned(join(path, entry));
    rmdirSync(path);
  } else unlinkSync(path);
}

mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), "yahtzee-mutation-proof-"));
try {
  mkdirSync(join(temporary, "packages/game-engine/src"), { recursive: true });
  for (const name of ["game", "scoring", "dice"]) copyFileSync(join(root, `packages/game-engine/src/${name}.ts`), join(temporary, `packages/game-engine/src/${name}.ts`));
  copyFileSync(join(root, "tsconfig.base.json"), join(temporary, "tsconfig.base.json"));
  writeFileSync(join(temporary, "package.json"), JSON.stringify({ private: true, type: "module" }));
  writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({ extends: "./tsconfig.base.json", compilerOptions: { noEmit: true, declaration: false, declarationMap: false, types: ["bun", "node"] }, include: ["packages/game-engine/src/**/*.ts"] }));
  symlinkSync(join(root, "node_modules"), join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  writeFileSync(join(temporary, "stryker.config.json"), JSON.stringify({ ...base, $schema: undefined, mutate: [`${file}:${line}-${line}`], commandRunner: { command: "bun test bonus.test.ts" }, tsconfigFile: "tsconfig.json", reporters: ["json"], jsonReporter: { fileName: "report.json" } }, null, 2));
  const results = [];
  for (const [name, test] of [["strong", strong], ["weak", weak]] as const) {
    writeFileSync(join(temporary, "bonus.test.ts"), test);
    const process = Bun.spawnSync(["node", join(root, "node_modules/@stryker-mutator/core/bin/stryker.js"), "run"], { cwd: temporary, stdout: "pipe", stderr: "pipe" });
    writeFileSync(join(output, `${name}.log`), Buffer.concat([process.stdout, process.stderr]));
    const report = JSON.parse(readFileSync(join(temporary, "report.json"), "utf8")) as MutationTestResult;
    copyFileSync(join(temporary, "report.json"), join(output, `${name}.json`));
    const gate = mutationGate(report, base.thresholds.break, [file]);
    const boundary = report.files[file].mutants.find((mutant) => mutant.replacement === "upperTotal > getUpperBonusThreshold(diceCount)");
    if (!boundary) throw new Error("The bonus-boundary mutant was not generated");
    results.push({ name, exitCode: process.exitCode, score: gate.metrics.mutationScore, passed: gate.passed, boundaryStatus: boundary.status, metrics: gate.metrics });
  }
  const [before, after] = results;
  if (before.exitCode !== 0 || !before.passed || before.boundaryStatus !== "Killed" || after.exitCode === 0 || after.passed || after.boundaryStatus !== "Survived" || after.score >= before.score) {
    throw new Error("The weakened assertion did not produce the expected mutation-gate failure");
  }
  if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim() !== commit) throw new Error("Revision changed during sensitivity qualification");
  writeFileSync(join(output, "summary.json"), JSON.stringify({ commit, dirty, threshold: base.thresholds.break, file, line, results }, null, 2) + "\n");
  console.log(`Focused bonus probe: strong ${before.score}%, weak ${after.score}%. Weak assertion rejected at the unchanged ${base.thresholds.break}% threshold.`);
} finally {
  removeOwned(temporary);
}
if (readFileSync(join(root, file), "utf8") !== original) throw new Error("Production source changed during the isolated probe");
