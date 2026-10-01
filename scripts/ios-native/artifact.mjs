import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function safeArtifactPath(path) {
  return typeof path === "string" && path.length > 0 && !/^[./\\]|[:\\\r\n\0]/.test(path) && !path.split("/").includes("..");
}
export function verifyBuild(build, expected) {
  assert.equal(build.schemaVersion, 1);
  assert.equal(build.kind, "unsigned-ios-simulator-build");
  assert.equal(build.status, "passed");
  assert.equal(build.source, expected.source, "Native app source differs from the checked-out tests.");
  assert.equal(build.architecture, expected.architecture);
  assert.equal(build.bunLockSha256, expected.bunLockSha256);
  if (expected.runId) assert.equal(build.runId, expected.runId, "Native app must come from this workflow run.");
  assert.equal(build.podInstallMode, "deployment");
  assert.equal(build.podLockNeedsReview, false);
  assert.deepEqual(build.privacy?.errors, []);
  assert(build.app?.directory?.endsWith(".app") && !/[/\\\r\n]/.test(build.app.directory));
  assert.equal(build.app.bundleId, expected.config.ios.bundleIdentifier);
  assert.equal(build.app.version, expected.config.version);
  assert.equal(build.app.build, expected.config.ios.buildNumber);
  assert(Array.isArray(build.artifacts) && build.artifacts.length > 0);
  const paths = new Set();
  for (const artifact of build.artifacts) {
    assert(safeArtifactPath(artifact.path), "Unsafe native artifact path.");
    assert(!paths.has(artifact.path), "Duplicate native artifact path."); paths.add(artifact.path);
    assert(/^[a-f0-9]{64}$/.test(artifact.sha256) && Number.isSafeInteger(artifact.bytes) && artifact.bytes >= 0);
  }
  assert(paths.has("unsigned-simulator.app.tar.gz"));
}
export function verifyArchivePaths(list, directory) {
  assert(list.length > 0);
  for (const path of list) {
    assert(safeArtifactPath(path) && (path === `${directory}/` || path.startsWith(`${directory}/`)), "Archive escapes its app directory.");
  }
}
export function loadBuiltSimulator({ root, run, hash, receipt, architecture }) {
  const input = join(root, "reports/native-build");
  const build = JSON.parse(readFileSync(join(input, "manifest.json"), "utf8"));
  const config = JSON.parse(readFileSync(join(root, "apps/mobile/app.json"), "utf8")).expo;
  verifyBuild(build, { source: receipt.source, architecture, bunLockSha256: receipt.bunLockSha256, runId: receipt.runId, config });
  for (const artifact of build.artifacts) {
    const bytes = readFileSync(join(input, artifact.path));
    assert.equal(bytes.length, artifact.bytes); assert.equal(hash(bytes), artifact.sha256, `Native artifact changed: ${artifact.path}`);
  }
  const archive = join(input, "unsigned-simulator.app.tar.gz");
  verifyArchivePaths(run("tar", ["-tzf", archive], { capture: true }).split("\n"), build.app.directory);
  const entries = run("tar", ["-tvzf", archive], { capture: true }).split("\n");
  assert(entries.every((line) => /^[d-]/.test(line)), "Archive contains links or special files.");
  const directory = mkdtempSync(join(tmpdir(), "dice-qualified-app-"));
  run("tar", ["-xzf", archive, "-C", directory], { log: "unpack.log" });
  const app = join(directory, build.app.directory);
  assert.equal(hash(readFileSync(join(app, "main.jsbundle"))), build.app.jsBundleSha256);
  receipt.app = build.app;
  receipt.build = { source: build.source, runId: build.runId, runAttempt: build.runAttempt, artifactSha256: hash(readFileSync(archive)), manifestSha256: hash(readFileSync(join(input, "manifest.json"))) };
  receipt.privacy = { errors: [], evidence: "Source-bound native-build artifact privacy-inspection.json" };
  return { app, bundleId: build.app.bundleId };
}
