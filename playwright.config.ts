import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "tests/clients", testMatch: "**/*.spec.ts", workers: 1, fullyParallel: false,
  timeout: 45_000, retries: 0,
  outputDir: "reports/clients/artifacts",
  reporter: [["list"], ["json", { outputFile: "reports/clients/results.json" }]],
  projects: [{ name: "web" }, { name: "desktop" }, { name: "mobile-web-adapter" }],
  use: { baseURL: "http://127.0.0.1:5187" },
  webServer: {
    command: "bun tests/clients/server.ts", url: "http://127.0.0.1:5187/health",
    reuseExistingServer: false, timeout: 30_000,
  },
});
