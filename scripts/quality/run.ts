import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { projectRoot } from "./sources";
import { writeRiskReport } from "./report";

const started = performance.now();
const raw = resolve(projectRoot, "reports/quality/raw");
rmSync(raw, { recursive: true, force: true }); mkdirSync(raw, { recursive: true });
function run(args: string[], environment: Record<string, string> = {}) {
  const child = spawnSync("bun", args, { cwd: projectRoot, stdio: "inherit", env: { ...process.env, ...environment } });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Qualification failed: bun ${args.join(" ")}, exit ${child.status}`);
}
run(["test", "--preload", "./scripts/quality/unit-preload.ts", "./packages/game-engine/tests"]);
run(["run", "test:clients"], { TEST_COVERAGE: "1" });
const errors = writeRiskReport();
for (const error of errors) console.error(error);
console.log(`Measurement completed in ${((performance.now() - started) / 1000).toFixed(1)} seconds.`);
if (errors.length) process.exitCode = 1;
