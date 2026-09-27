import { test as base, type TestInfo } from "playwright/test";
import type { ElectronApplication, Page } from "playwright";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { expect } from "playwright/test";
export { expect };
const require = createRequire(import.meta.url);
export const origin = "http://127.0.0.1:5187";
export const desktopApplications = new WeakMap<Page, ElectronApplication>();

export async function saveCoverage(page: Page, info: TestInfo, stage = "final") {
  if (process.env.TEST_COVERAGE !== "1") return;
  const data = await page.evaluate(() => (globalThis as typeof globalThis & { __coverage__?: object }).__coverage__);
  if (!data || !Object.keys(data).length) throw new Error("Client coverage collection is empty");
  const folder = resolve("reports/quality/raw"); mkdirSync(folder, { recursive: true });
  const id = createHash("sha256").update(info.testId).digest("hex").slice(0, 16);
  writeFileSync(resolve(folder, `client-${id}-${stage}.json`), JSON.stringify(data));
  const response = await fetch(`${origin}/coverage`);
  if (!response.ok) throw new Error("Backend coverage collection failed");
  writeFileSync(resolve(folder, "backend.json"), JSON.stringify(await response.json()));
}
export const test = base.extend<{ client: Page }>({
  client: async ({ playwright }, runWithPage, info) => {
    info.annotations.push({ type: "commit", description: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() });
    info.annotations.push({ type: "dirty", description: String(!!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()) });
    if (info.project.name === "desktop") {
      const env: Record<string, string> = Object.fromEntries(Object.entries(process.env)
        .filter((entry): entry is [string, string] => entry[1] !== undefined));
      env.ELECTRON_RENDERER_URL = `${origin}/desktop`;
      delete env.ELECTRON_RUN_AS_NODE;
      const profile = mkdtempSync(join(tmpdir(), "yahtzee-client-"));
      try {
        const app = await playwright._electron.launch({
          executablePath: require("../../apps/desktop/node_modules/electron"),
          args: [resolve("apps/desktop"), `--user-data-dir=${profile}`], env,
          recordVideo: { dir: info.outputPath("videos") },
        });
        try {
          const page = await app.firstWindow();
          desktopApplications.set(page, app);
          await app.context().tracing.start({ screenshots: true, snapshots: true });
          try {
            await page.waitForLoadState();
            expect(await app.evaluate(({ app: application }) => application.getPath("userData"))).toBe(profile);
            expect(await page.evaluate(() => (window as Window & { platform?: { name: string } }).platform?.name)).toBe("electron");
            await runWithPage(page);
          } finally {
            try { await saveCoverage(page, info); }
            finally { await app.context().tracing.stop({ path: info.outputPath("trace.zip") }); }
          }
        } finally { await app.close(); }
      } finally { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
    } else {
      const browser = await playwright.chromium.launch();
      try {
        const context = await browser.newContext({
          viewport: info.project.name === "web" ? { width: 1280, height: 900 } : { width: 390, height: 844 },
          recordVideo: { dir: info.outputPath("videos") },
        });
        try {
          await context.tracing.start({ screenshots: true, snapshots: true });
          const page = await context.newPage();
          try { await runWithPage(page); }
          finally {
            try { await saveCoverage(page, info); }
            finally { await context.tracing.stop({ path: info.outputPath("trace.zip") }); }
          }
        } finally { await context.close(); }
      } finally { await browser.close(); }
    }
  },
});
