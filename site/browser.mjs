import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { buildSite, repositoryRoot } from "./build.mjs";
import { pages } from "./pages.mjs";
import { serveSite } from "./serve.mjs";
import { visibleContrastFailures } from "./contrast.mjs";

const output = resolve(process.argv[2] ?? join(repositoryRoot, "reports/site-review"));
assert(!existsSync(output), "Existing browser evidence was not overwritten.");
mkdirSync(output, { recursive: true });
const site = join(output, "site"); buildSite(site);
const running = await serveSite(site, "/yahtzee/");
const browser = await chromium.launch({ headless: true });
const failures = [];
const profiles = [
  { name: "desktop-light", width: 1440, height: 1000, colorScheme: "light", textScale: 1 },
  { name: "phone-light", width: 390, height: 844, colorScheme: "light", textScale: 1 },
  { name: "phone-dark", width: 390, height: 844, colorScheme: "dark", textScale: 1 },
  { name: "narrow-large-text", width: 320, height: 700, colorScheme: "light", textScale: 2 },
];
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, colorScheme: profile.colorScheme, reducedMotion: "reduce", recordVideo: profile.name === "desktop-light" ? { dir: join(output, "video"), size: { width: 1440, height: 1000 } } : undefined });
    await context.route("**/*", (route) => {
      if (route.request().url().startsWith(running.url)) return route.continue();
      failures.push(`Unexpected request: ${route.request().url()}`); return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
    for (const file of Object.keys(pages)) {
      await page.goto(running.url + file);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((scale) => { document.documentElement.style.fontSize = `${16 * scale}px`; }, profile.textScale);
      try {
        assert.equal(await page.locator("h1").count(), 1);
        assert.equal(await page.locator("script,iframe,form").count(), 0);
        assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
        assert.deepEqual(await context.cookies(), []);
        const geometry = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth, outside: [...document.querySelectorAll("nav a,.button,summary")].filter((element) => {
          const bounds = element.getBoundingClientRect(); return bounds.left < -1 || bounds.right > innerWidth + 1 || bounds.height < 44;
        }).map((element) => element.textContent) }));
        assert(geometry.body <= geometry.viewport + 1, `${file}: horizontal overflow ${JSON.stringify(geometry)}`);
        assert.deepEqual(geometry.outside, [], `${file}: clipped or undersized navigation`);
        assert.deepEqual(await page.evaluate(visibleContrastFailures), [], `${file}: insufficient text contrast`);
        for (const href of await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
          if (href.startsWith("https:")) continue;
          const url = new URL(href, page.url());
          assert.equal((await context.request.get(url.href.split("#")[0])).status(), 200, href);
          if (url.hash && url.pathname === new URL(page.url()).pathname) assert.equal(await page.locator(url.hash).count(), 1, href);
        }
        await page.keyboard.press("Tab");
        assert.equal(await page.locator(":focus").textContent(), "Skip to content");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(":focus").getAttribute("id"), "main");
        if (file === "index.html" && profile.textScale === 2) {
          const table = page.getByRole("region", { name: "Game mode comparison, horizontally scrollable" });
          await table.focus();
          for (let step = 0; step < 16; step++) await page.keyboard.press("ArrowRight");
          await page.waitForFunction(() => document.querySelector(".table-scroll")?.scrollLeft > 0, undefined, { timeout: 2000 });
          assert(await table.evaluate((element) => element.scrollLeft > 0), "Mode table must support keyboard scrolling");
          await table.evaluate((element) => { element.scrollLeft = 0; });
        }
        if (file === "support.html") {
          const summary = page.getByText("A save was not confirmed", { exact: true });
          await summary.click();
          assert.equal(await summary.locator("..").getAttribute("open"), "");
          await summary.click();
        }
      } catch (error) { failures.push(`${profile.name}/${file}: ${error.message}`); }
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: join(output, `${profile.name}-${file.replace(".html", "")}.png`), fullPage: true });
    }
    await context.close();
  }
} finally { await browser.close(); await running.close(); }
const git = (...args) => execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8" }).trim();
const receipt = { sourceCommit: git("rev-parse", "HEAD"), sourceDirty: git("status", "--porcelain").length > 0, browser: "Chromium", profiles, failures, publicationAuthorized: false };
writeFileSync(join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
assert.deepEqual(failures, [], "Website browser checks failed; inspect receipt.json and captures.");
console.log(`Website browser checks passed across ${profiles.length} profiles and ${Object.keys(pages).length} pages.`);
