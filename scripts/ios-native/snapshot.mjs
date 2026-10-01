import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Detached XCTest writers may outlive Maestro. Upload immutable copies, not their live log paths. */
export function snapshotEvidence(input, output, receipt) {
  assert(!existsSync(output), "Existing published native evidence was not overwritten.");
  mkdirSync(output, { recursive: true });
  const artifacts = [];
  function copy(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = prefix + entry.name;
      if (entry.isDirectory()) { copy(join(directory, entry.name), path + "/"); continue; }
      if (!entry.isFile() || path === "manifest.json") continue;
      // Size and hash come from the same read, even if the source keeps growing.
      const bytes = readFileSync(join(directory, entry.name));
      const destination = join(output, path);
      mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, bytes);
      artifacts.push({ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  copy(input);
  const published = { ...receipt, evidenceSnapshotAt: new Date().toISOString(), artifacts };
  writeFileSync(join(output, "manifest.json"), JSON.stringify(published, null, 2) + "\n");
  return published;
}
function main() {
  const root = resolve(import.meta.dirname, "../..");
  const input = join(root, "reports/native"); const output = join(root, "reports/native-evidence");
  if (existsSync(output)) {
    assert(existsSync(join(output, "manifest.json")), "Published evidence is incomplete; existing files were not overwritten.");
    console.log("Native evidence is already frozen."); return;
  }
  const manifest = join(input, "manifest.json");
  if (!existsSync(manifest)) { console.log("Native qualification did not create a receipt."); return; }
  const receipt = JSON.parse(readFileSync(manifest, "utf8"));
  if (receipt.status === "running") {
    receipt.status = "failed"; receipt.error = "Native process ended before finalizing evidence.";
  }
  snapshotEvidence(input, output, receipt);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
