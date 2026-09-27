import { expect, test } from "bun:test";
import { diagnosticText } from "../../../apps/mobile/src/local/diagnostics";

test("diagnostics serialize only the explicit nonpersonal allowlist", () => {
  const input = { version: "1.0.0", build: "1", platform: "ios", osVersion: "26.5", windowClass: "compact" as const,
    name: "PRIVATE NAME", scores: "PRIVATE SCORES", gameId: "PRIVATE ID", logs: "PRIVATE LOGS", credentials: "PRIVATE CREDENTIALS" };
  const text = diagnosticText(input);
  expect(text).toContain("Dice game 1.0.0, build 1");
  expect(text).toContain("Platform: ios 26.5");
  expect(text).toContain("Window: compact");
  expect(text).not.toContain("PRIVATE");
  expect(text).toContain("No names, scores, game IDs or saved data are included.");
});
