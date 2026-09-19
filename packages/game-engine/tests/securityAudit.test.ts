import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { checkAudit } from "../../../scripts/security-policy";
import manifest from "../../../package.json";

const advisory = "https://github.com/advisories/GHSA-w5hq-g745-h8pq";
const report = { uuid: [{ url: advisory, severity: "moderate" }] };
const exception = { package: "uuid", advisory, owner: "HemSoft", rationale: "Fixture only", expires: "2026-10-01" };

describe("dependency policy", () => {
  test("accepts a clean report and rejects every unaccepted severity", () => {
    expect(checkAudit({}, [], "2026-09-18")).toEqual([]);
    expect(checkAudit(report, [], "2026-09-18")).toHaveLength(1);
    expect(checkAudit({ uuid: [{ url: advisory, severity: "low" }] }, [], "2026-09-18")).toHaveLength(1);
  });
  test("exceptions are exact, owned and expire", () => {
    expect(checkAudit(report, [exception], "2026-09-18")).toEqual([]);
    expect(checkAudit(report, [{ ...exception, package: "other" }], "2026-09-18")).toHaveLength(1);
    expect(() => checkAudit(report, [{ ...exception, owner: "" }], "2026-09-18")).toThrow();
    expect(() => checkAudit(report, [exception], "2026-10-01")).toThrow();
  });
  test("network/errors or unknown report shapes fail closed", () => {
    expect(() => checkAudit({ error: "network failure" }, [], "2026-09-18")).toThrow();
    expect(() => checkAudit([], [], "2026-09-18")).toThrow();
    expect(() => checkAudit({ uuid: [{}] }, [], "2026-09-18")).toThrow();
  });
  test("Stryker's real REST client resolves the fixed qs parser", () => {
    const root = createRequire(new URL("../../../package.json", import.meta.url));
    const stryker = createRequire(root.resolve("@stryker-mutator/core"));
    const rest = createRequire(stryker.resolve("typed-rest-client/package.json"));
    const query = rest("qs");
    expect(rest("qs/package.json").version).toBe(manifest.overrides.qs);
    expect(query.stringify({ dice: 6, name: "A B" })).toBe("dice=6&name=A%20B");
    expect(query.stringify({ x: [null, undefined] }, { arrayFormat: "comma", encodeValuesOnly: true })).toBe("x=,");
    expect(() => query.parse("a[0]=1,2,3", { comma: true, arrayLimit: 1, throwOnLimitExceeded: true })).toThrow("Array limit exceeded");
  });
  test("Expo Router's real query-string consumer uses the patched decoder", () => {
    const mobile = createRequire(new URL("../../../apps/mobile/package.json", import.meta.url));
    const router = createRequire(mobile.resolve("expo-router/package.json"));
    const query = router("query-string");
    expect({ ...query.parse("name=A%20B&dice=5&tag=a&tag=b") }).toEqual({ name: "A B", dice: "5", tag: ["a", "b"] });
    expect(query.stringify({ name: "A B", dice: 5 })).toBe("dice=5&name=A%20B");
    expect(query.parse("name=%F0%9F%8E%B2").name).toBe("🎲");
    // Malformed input previously entered exponential recursive decoding.
    const malformed = "%".repeat(10_000);
    expect(query.parse(`name=${malformed}`).name).toBe(malformed);
  });
});
