import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { redactDriverLog, retainDriverLogs } from "./driverLogs.mjs";

test("driver evidence redacts credential environment values and authorization headers", () => {
  assert.equal(redactDriverLog("tap at 20,40 synthetic-secret-value Authorization: Bearer synthetic-token", { RUNTIME_TOKEN: "synthetic-secret-value", ORDINARY: "tap at" }),
    "tap at 20,40 <REDACTED> Authorization: Bearer <REDACTED>");
});
test("only known driver logs become non-hidden uploaded evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "native-driver-log-"));
  try {
    retainDriverLogs(directory, directory, "start", {});
    const source = join(directory, ".maestro/tests/run"); mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "maestro.log"), "target score-ones");
    writeFileSync(join(source, "unrelated.json"), "not evidence");
    retainDriverLogs(directory, directory, "start", {});
    assert.equal(readFileSync(join(directory, "start-driver-0.log"), "utf8"), "target score-ones");
    assert.deepEqual(readdirSync(directory).sort(), [".maestro", "start-driver-0.log"]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
