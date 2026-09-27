import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export function draftErrors(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["Record must be an object"];
  const errors = [];
  if (record.schemaVersion !== 1) errors.push("Unsupported record schema");
  if (!/^\d+\.\d+\.\d+$/.test(record.version ?? "")) errors.push("Invalid marketing version");
  if (typeof record.buildNumber !== "string" || !/^[1-9]\d*$/.test(record.buildNumber)) errors.push("Build number must be a positive integer string");
  if (record.tag !== `ios/v${record.version}`) errors.push("Tag does not match the iOS version");
  if (record.appStoreVersion !== record.version) errors.push("App Store version mismatch");
  if (!["draft", "candidate"].includes(record.status)) errors.push("Unknown candidate status");
  return errors;
}

export function releaseBlockers(record, context) {
  const blockers = [...draftErrors(record)];
  if (blockers.length) return blockers;
  if (record.status !== "candidate") blockers.push("Candidate is still a draft");
  if (!/^[a-f0-9]{40}$/.test(record.sourceCommit ?? "") || record.sourceCommit !== context.commit) blockers.push("Source commit does not match HEAD");
  if (context.dirty) blockers.push("Tracked or untracked source changes remain");
  if (record.version !== context.expo.version) blockers.push("Native marketing version mismatch");
  if (record.buildNumber !== context.expo.ios?.buildNumber) blockers.push("Native build number mismatch");
  if (!record.bundleIdentifier || record.bundleIdentifier !== context.expo.ios?.bundleIdentifier) blockers.push("Approved bundle identifier missing or mismatched");
  if (!/^[1-9]\d*$/.test(record.appStoreId ?? "")) blockers.push("App Store app ID missing");
  if (!/^[a-f0-9]{64}$/.test(record.archiveSha256 ?? "") || record.archiveSha256 !== context.archiveSha256) blockers.push("Archive checksum missing or mismatched");
  for (const key of ["testFlightBuildId", "ownerApprovalEvidence", "nativeQualificationEvidence"]) {
    if (typeof record[key] !== "string" || !record[key].trim()) blockers.push(`${key} missing`);
  }
  return blockers;
}

function sourceFiles(record, mobile) {
  const paths = [record.changelog, record.testNotes, record.screenshots];
  const metadata = record.metadataDirectory;
  for (const name of ["listing.json", "description.txt", "review_notes.txt", "release_notes.txt"]) paths.push(`${metadata}/${name}`);
  return paths.map((path) => {
    if (typeof path !== "string" || path.includes("..") || !/^[A-Za-z0-9_./-]+$/.test(path)) throw new Error("Invalid release source path");
    const text = readFileSync(resolve(mobile, path), "utf8");
    if (!text.trim()) throw new Error(`Empty release source: ${path}`);
    return { path, text };
  });
}

function run() {
  const mobile = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const release = args.includes("--release");
  const option = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  const record = JSON.parse(readFileSync(resolve(option("--record") ?? resolve(mobile, "release/candidate.json")), "utf8"));
  const errors = draftErrors(record);
  if (errors.length) throw new Error(errors.join("; "));
  const files = sourceFiles(record, mobile);
  const git = (...parts) => execFileSync("git", parts, { cwd: mobile, encoding: "utf8" }).trim();
  const archive = option("--archive");
  const context = {
    commit: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")),
    expo: JSON.parse(readFileSync(resolve(mobile, "app.json"), "utf8")).expo,
    archiveSha256: archive ? createHash("sha256").update(readFileSync(resolve(archive))).digest("hex") : null,
  };
  const blockers = releaseBlockers(record, context);
  for (const file of files) {
    if (/DRAFT, NOT APPROVED/.test(file.text)) blockers.push(`Unapproved copy: ${file.path}`);
  }
  const screenshots = JSON.parse(files.find((file) => file.path === record.screenshots).text);
  if (screenshots.sourceCommit !== record.sourceCommit || screenshots.version !== record.version || screenshots.buildNumber !== record.buildNumber) blockers.push("Screenshot provenance mismatch");
  if (!Array.isArray(screenshots.captures) || screenshots.captures.length === 0) blockers.push("No native screenshot captures recorded");
  const listing = JSON.parse(files.find((file) => file.path.endsWith("listing.json")).text);
  for (const key of ["name", "subtitle", "copyright", "supportUrl", "marketingUrl", "privacyUrl"]) {
    if (!listing[key]) blockers.push(`Listing field missing: ${key}`);
  }
  console.log(JSON.stringify({ mode: release ? "release" : "draft", version: record.version, build: record.buildNumber, consistent: blockers.length === 0, blockers, note: "Consistency only. This command does not validate signing, grant approval, upload, submit or publish." }, null, 2));
  if (release && blockers.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
