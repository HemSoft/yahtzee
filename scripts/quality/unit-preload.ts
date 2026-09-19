import "./instrument-preload";
import { afterAll } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot } from "./sources";

// Bun's test runner does not run process exit handlers. Persist from its hook.
afterAll(() => {
  const folder = resolve(projectRoot, "reports/quality/raw"); mkdirSync(folder, { recursive: true });
  const coverage = (globalThis as typeof globalThis & { __coverage__?: object }).__coverage__;
  if (!coverage || !Object.keys(coverage).length) throw new Error("Unit coverage collection is empty");
  writeFileSync(resolve(folder, "unit.json"), JSON.stringify(coverage));
});
