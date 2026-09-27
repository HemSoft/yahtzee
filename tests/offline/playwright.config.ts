import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, fullyParallel: false,
  timeout: 180_000, retries: 0,
  outputDir: "../../reports/offline/artifacts",
  reporter: [["list"], ["json", { outputFile: "reports/offline/results.json" }]],
});
