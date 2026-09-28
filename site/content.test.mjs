import assert from "node:assert/strict";
import test from "node:test";
import { getCategories, getUpperBonusThreshold, getUpperBonusValue } from "../packages/game-engine/src/scoring.ts";
import { pages, externalLinks } from "./pages.mjs";

test("visible native mode table agrees with the shared scoring rules", () => {
  for (const dice of [5, 6, 8, 10]) {
    const values = [getCategories(dice).length, getUpperBonusThreshold(dice), getUpperBonusValue(dice)];
    const row = `<tr><th scope="row">${dice}</th>${values.map((value) => `<td>${value}</td>`).join("")}</tr>`;
    assert(pages["index.html"].includes(row), `Incorrect visible mode facts for ${dice} dice`);
  }
});
test("every local page and fragment exists, including cross-page destinations", () => {
  const origin = "https://preview.invalid/yahtzee/";
  const external = new Set();
  for (const [file, html] of Object.entries(pages)) {
    for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
      const url = new URL(href, origin + file);
      if (url.origin !== "https://preview.invalid") { external.add(url.href); continue; }
      assert(url.pathname.startsWith("/yahtzee/"));
      const target = pages[url.pathname.slice("/yahtzee/".length)]; assert(target, href);
      if (url.hash) assert(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), href);
    }
  }
  assert.deepEqual([...external].sort(), [...externalLinks].sort());
});
