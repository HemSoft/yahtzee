import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { snapshotEvidence } from "./snapshot.mjs";

test("late same-size XCTest log rewrites cannot change published evidence or its hash inventory", () => {
  const root = mkdtempSync(join(tmpdir(), "native-evidence-"));
  try {
    const input = join(root, "working"); const output = join(root, "published");
    mkdirSync(join(input, "flow/.maestro"), { recursive: true });
    writeFileSync(join(input, "flow/driver.log"), "initial");
    writeFileSync(join(input, "flow/.maestro/private.log"), "excluded");
    writeFileSync(join(input, "manifest.json"), "working checkpoint");
    const receipt = snapshotEvidence(input, output, { schemaVersion: 1, status: "failed", source: "test-source" });
    writeFileSync(join(input, "flow/driver.log"), "changed");
    assert.equal(readFileSync(join(output, "flow/driver.log"), "utf8"), "initial");
    assert.deepEqual(receipt.artifacts, [{ path: "flow/driver.log", bytes: 7, sha256: createHash("sha256").update("initial").digest("hex") }]);
    assert.deepEqual(readdirSync(join(output, "flow")), ["driver.log"]);
    assert.equal(JSON.parse(readFileSync(join(output, "manifest.json"))).status, "failed");
    assert.throws(() => snapshotEvidence(input, output, {}), /not overwritten/);
    assert.equal(readFileSync(join(output, "flow/driver.log"), "utf8"), "initial");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
