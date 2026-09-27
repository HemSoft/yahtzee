import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relativeSource, readSource, copyBlockers, screenshotBlockers, sha256, artifactImageReader } from "./evidence.mjs";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=", "base64");
const record = { sourceCommit: "a".repeat(40), version: "1.0.0", buildNumber: "1" };
const capture = { filename: "iphone.png", sourceCommit: record.sourceCommit, deviceFamily: "iphone", locale: "en-US", appearance: "light", width: 1, height: 1, sha256: sha256(png) };
const manifest = { ...record, status: "accepted", captures: [capture] };

test("source paths reject absolute and parent traversal", () => {
  for (const path of ["/tmp/secret", "C:/secret", "../secret", "release/../../secret", null]) assert.throws(() => relativeSource(path));
  assert.equal(relativeSource("release/metadata/en-US/listing.json"), "release/metadata/en-US/listing.json");
});
test("release source must exist in the commit and match its bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "ios-source-"));
  try {
    writeFileSync(join(root, "copy.txt"), "approved copy");
    assert.equal(readSource(root, "copy.txt", () => Buffer.from("approved copy")).text, "approved copy");
    assert.throws(() => readSource(root, "copy.txt", () => Buffer.from("other copy")), /differs/);
    writeFileSync(join(root, "copy.txt"), "approved\r\ncopy\r\n");
    assert.equal(readSource(root, "copy.txt", () => Buffer.from("approved\ncopy\n")).text, "approved\ncopy\n");
    mkdirSync(join(root, "reports")); writeFileSync(join(root, "reports", "untracked.txt"), "ignored draft");
    assert.throws(() => readSource(root, "reports/untracked.txt", () => { throw new Error("not in commit"); }), /not in commit/);
  } finally { rmSync(root, { recursive: true }); }
});
test("mixed-case draft notes and structured draft statuses cannot pass", () => {
  const listing = { status: "approved", name: "Game", subtitle: "Dice", keywords: "dice", primaryCategory: "GAMES", copyright: "Owner", supportUrl: "https://example.test/support", marketingUrl: "https://example.test", privacyUrl: "https://example.test/privacy" };
  const files = ["description", "reviewNotes", "releaseNotes", "testNotes"].map((role) => ({ path: role, role, text: "Accepted copy" }));
  listing.sourceReviews = Object.fromEntries(files.map((file) => [file.role, { status: "approved", sha256: sha256(Buffer.from(file.text)) }]));
  assert.deepEqual(copyBlockers(files, listing), []);
  for (const key of ["primaryCategory", "keywords"]) assert.ok(copyBlockers(files, { ...listing, [key]: null }).length);
  assert.ok(copyBlockers([{ ...files[0], text: "Changed after review" }, ...files.slice(1)], listing).length);
  for (const text of ["Draft only. No signed candidate", "draft, not approved for upload", "NOT APPROVED FOR SUBMISSION", "Do not publish this placeholder", "pending implementation", "After native qualification, describe...", "replacing this draft with tester-facing copy"]) assert.ok(copyBlockers([{ ...files[0], text }, ...files.slice(1)], listing).length);
  assert.ok(copyBlockers([], { ...listing, status: "draft" }).length);
  assert.ok(screenshotBlockers({ ...manifest, status: "not-captured" }, record, () => png).length);
});
test("empty or invented screenshot entries fail while a matching file passes", () => {
  assert.deepEqual(screenshotBlockers(manifest, record, () => png), []);
  for (const captures of [[], [{}], [null], [{ ...capture, filename: "../outside.png" }]]) assert.ok(screenshotBlockers({ ...manifest, captures }, record, () => png).length);
  assert.ok(screenshotBlockers(manifest, record, () => { throw new Error("missing"); }).length);
});
test("each capture requires provenance, device, locale, appearance, dimensions and checksum", () => {
  const invalid = [{ sourceCommit: "b".repeat(40) }, { deviceFamily: null }, { locale: null }, { appearance: null }, { width: 2 }, { height: 0 }, { sha256: "0".repeat(64) }];
  for (const patch of invalid) assert.ok(screenshotBlockers({ ...manifest, captures: [{ ...capture, ...patch }] }, record, () => png).length);
  assert.ok(screenshotBlockers(manifest, record, () => Buffer.from("not an image")).length);
  assert.ok(screenshotBlockers({ ...manifest, buildNumber: "2" }, record, () => png).length);
});
test("artifact reader resolves only files inside its own directory", () => {
  const root = mkdtempSync(join(tmpdir(), "ios-images-"));
  try {
    writeFileSync(join(root, "iphone.png"), png);
    const read = artifactImageReader(root);
    assert.deepEqual(read("iphone.png"), png);
    assert.throws(() => read("../outside.png"));
  } finally { rmSync(root, { recursive: true }); }
});
