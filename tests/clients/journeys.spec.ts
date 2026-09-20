import { test as base, expect, type TestInfo } from "playwright/test";
import type { Page } from "playwright";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { getCategories } from "../../packages/game-engine/src/scoring";

const require = createRequire(import.meta.url);
const origin = "http://127.0.0.1:5187";

async function expectNoDocumentOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientHeight);
  expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
}

async function expectNoScorecardOverflow(page: Page) {
  const metrics = await page.getByTestId("scorecard-scroll-container").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(metrics.scrollHeight - metrics.clientHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.overflowY, JSON.stringify(metrics)).toBe("hidden");
}

async function saveCoverage(page: Page, info: TestInfo) {
  if (process.env.TEST_COVERAGE !== "1") return;
  const data = await page.evaluate(() => (globalThis as typeof globalThis & { __coverage__?: object }).__coverage__);
  if (!data || !Object.keys(data).length) throw new Error("Client coverage collection is empty");
  const folder = resolve("reports/quality/raw"); mkdirSync(folder, { recursive: true });
  const id = createHash("sha256").update(info.testId).digest("hex").slice(0, 16);
  writeFileSync(resolve(folder, `client-${id}.json`), JSON.stringify(data));
  const response = await fetch(`${origin}/coverage`);
  if (!response.ok) throw new Error("Backend coverage collection failed");
  writeFileSync(resolve(folder, "backend.json"), JSON.stringify(await response.json()));
}
const test = base.extend<{ client: Page }>({
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

for (const diceCount of [5, 6]) {
  test(`${diceCount} dice: complete, retry, reconnect, play again and cancel`, async ({ client, request }, info) => {
    const mobile = info.project.name === "mobile-web-adapter";
    const route = mobile ? "mobile" : info.project.name;
    const errors: string[] = []; client.on("pageerror", (error) => errors.push(error.message));
    await request.post("/control", { data: { reset: true } });
    await client.goto(`${origin}/${route}`);
    const name = `${route} ${diceCount}`;
    const textbox = client.getByRole("textbox");
    await textbox.fill(name);
    await client.getByRole("button", { name: "1 AI", exact: true }).click();
    await client.getByRole("button", { name: mobile ? String(diceCount) : diceCount === 5 ? "Classic (5)" : "Extended (6)", exact: true }).click();
    if (diceCount === 6) await client.getByRole("button", { name: "Switch to dark mode" }).click();
    if (info.project.name === "desktop") await expectNoDocumentOverflow(client);
    await client.screenshot({ path: info.outputPath("setup.png"), fullPage: true });
    await client.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(client.getByRole("button", { name: "Re-roll (2)", exact: true })).toBeEnabled();
    if (info.project.name === "desktop") {
      await expectNoDocumentOverflow(client);
      await expectNoScorecardOverflow(client);
      await expect(client.getByRole("row", { name: /Grand Total/ })).toBeInViewport();
      await client.screenshot({ path: info.outputPath("initial.png") });
    }
    const firstDie = client.getByRole("button", { name: /^Die showing / }).first();
    const heldValue = await firstDie.textContent();
    await firstDie.click();
    await expect(client.getByRole("button", { name: "Re-roll (2)", exact: true })).toBeEnabled();
    await client.getByRole("button", { name: "Re-roll (2)", exact: true }).click();
    await expect(client.getByRole("button", { name: "Re-roll (1)", exact: true })).toBeEnabled();
    expect(await firstDie.textContent()).toBe(heldValue);

    await client.context().setOffline(true);
    await client.getByRole("button", { name: "Re-roll (1)", exact: true }).click();
    await expect(client.getByRole("alert")).toBeVisible();
    await client.context().setOffline(false);
    await client.getByRole("button", { name: "Retry move", exact: true }).click();
    await expect(client.getByRole("button", { name: "Re-roll (0)", exact: true })).toBeDisabled();
    await expect(client.getByRole("button", { name: "Score Ones", exact: true })).toBeEnabled();
    await client.screenshot({ path: info.outputPath("active.png"), fullPage: true });

    const categories = getCategories(diceCount);
    for (const [index, category] of categories.slice(0, -1).entries()) {
      const choice = client.getByRole("button", { name: `Score ${category.label}`, exact: true });
      await expect(choice).toBeEnabled();
      if (index === 0) { await choice.focus(); await client.keyboard.press("Enter"); }
      else await choice.click();
      await expect(client.getByText(new RegExp(`Round ${index + 2}\\s*/\\s*${categories.length}`))).toBeVisible();
    }
    await request.post("/control", { data: { loseResponse: true } });
    await client.getByRole("button", { name: `Score ${categories.at(-1)!.label}`, exact: true }).click();
    await expect(client.getByRole("alert")).toBeVisible();
    await client.screenshot({ path: info.outputPath("retry.png"), fullPage: true });
    const committed = await (await request.get("/inspect")).json();
    expect(committed.logs).toHaveLength(1); expect(committed.receiptCount).toBe(2);
    await client.getByRole("button", { name: "Retry move", exact: true }).click();
    await expect(client.getByText("Game Over!", { exact: true })).toBeVisible();
    await expect(client.getByText(`🏅 High Scores (${diceCount} dice)`, { exact: true })).toBeVisible();
    for (const player of committed.logs[0].players) {
      await expect(client.getByText(`${player.score} pts`, { exact: false }).first()).toBeVisible();
    }
    const saved = await (await request.get("/inspect")).json();
    expect(saved.logs).toHaveLength(1); expect(saved.scores).toHaveLength(2); expect(saved.receiptCount).toBe(2);
    await client.screenshot({ path: info.outputPath("results.png"), fullPage: true });

    await client.getByRole("button", { name: "Play Again", exact: true }).click();
    await expect(client.getByRole("button", { name: "Start Game", exact: true })).toBeVisible();
    await textbox.fill("Cancelled guest");
    await client.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(client.getByRole("button", { name: "Re-roll (2)", exact: true })).toBeEnabled();
    await request.post("/control", { data: { delay: 600 } });
    const delayed = client.waitForResponse((response) => response.url().endsWith("/rpc") && response.request().postDataJSON()?.name === "games:move");
    await client.getByRole("button", { name: "Re-roll (2)", exact: true }).click();
    await client.getByRole("button", { name: "✕ Quit Game", exact: true }).click();
    await textbox.fill("Replacement guest");
    await client.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(client.getByText(/Replacement guest's turn/)).toBeVisible();
    await (await delayed).finished();
    await client.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    await expect(client.getByText(/Replacement guest's turn/)).toBeVisible();
    expect((await (await request.get("/inspect")).json()).logs).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
