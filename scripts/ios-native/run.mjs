import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { getScorecardCategories } from "../../packages/game-engine/src/presentation.ts";
import { decodeSave } from "../../apps/mobile/src/local/save.ts";
import { startFlow, resumeFlow, completeFlow, corruptFlow, scenarios } from "./flows.mjs";

assert.equal(process.platform, "darwin", "Native qualification requires macOS, Xcode and iOS simulators.");
const root = resolve(import.meta.dirname, "../..");
const output = join(root, "reports/native");
mkdirSync(output, { recursive: true });
const env = { ...process.env, DEVELOPER_DIR: "/Applications/Xcode_26.6.app/Contents/Developer", EXPO_NO_TELEMETRY: "1",
  MAESTRO_CLI_NO_ANALYTICS: "true", MAESTRO_DISABLE_UPDATE_CHECK: "true", MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true", MAESTRO_DRIVER_STARTUP_TIMEOUT: "120000" };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
function run(executable, args, { cwd = root, capture = false, timeout = 1800000, log = "commands.log" } = {}) {
  console.log(`$ ${executable} ${args.join(" ")}`);
  const fd = openSync(join(output, log), "a");
  let result;
  try { result = spawnSync(executable, args, { cwd, env, encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", capture ? "pipe" : fd, fd] }); }
  finally { closeSync(fd); }
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${executable} failed with ${result.status}; see ${log}`);
  return result.stdout?.trim() ?? "";
}
const sim = (...args) => run("xcrun", ["simctl", ...args], { capture: true, timeout: 180000 });
const plist = (file, key) => run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, file], { capture: true });
const receipt = { schemaVersion: 1, kind: "unsigned-ios-simulator", status: "running", source: run("git", ["rev-parse", "HEAD"], { capture: true }),
  startedAt: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  runnerImage: process.env.ImageVersion ?? null, scenarios: [], limits: ["Not a signed device archive", "Not TestFlight or physical-device evidence", "No airplane-mode or VoiceOver acceptance claim", "Public identity and release approvals remain unset"] };
json(join(output, "manifest.json"), receipt);
const appRoot = join(root, "apps/mobile");
const ownedDevices = [];
let recording = null;
async function stopRecording() {
  if (!recording) return;
  const child = recording; recording = null;
  if (child.exitCode !== null) return;
  const stopped = new Promise((done) => child.once("close", done));
  const controller = new AbortController();
  child.kill("SIGINT");
  try { await Promise.race([stopped, delay(15000, undefined, { signal: controller.signal }).then(() => { child.kill("SIGTERM"); throw new Error("Simulator recording did not stop."); })]); }
  finally { controller.abort(); }
}
function flow(device, directory, name, content) {
  const file = join(directory, `${name}.yaml`); writeFileSync(file, content);
  run("maestro", ["--device", device, "test", "--test-output-dir", join(directory, name), "--debug-output", join(directory, `${name}-debug`),
    "--format", "JUNIT", "--output", join(directory, `${name}.xml`), file], { timeout: 600000, log: `${name}-${directory.split(/[\\/]/).at(-1)}.log` });
}
function saved(device, bundleId, directory, stage) {
  const container = sim("get_app_container", device, bundleId, "data");
  const database = join(container, "Documents/SQLite/hemsoft-local-dice.db");
  const rows = JSON.parse(run("sqlite3", ["-readonly", "-json", database, "SELECT value FROM local_save WHERE key = 'hemsoft-local-dice-v1'"], { capture: true }));
  assert.equal(rows.length, 1);
  const bytes = rows[0].value;
  const data = decodeSave(bytes);
  writeFileSync(join(directory, `${stage}-save.json`), bytes + "\n");
  return { bytes, data, database };
}
function artifactFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix + entry.name; const path = join(directory, entry.name);
    if (entry.isDirectory()) return artifactFiles(path, relative + "/");
    if (!entry.isFile() || relative === "manifest.json") return [];
    return [{ path: relative, bytes: statSync(path).size, sha256: hash(readFileSync(path)) }];
  });
}
try {
  assert.equal(run("git", ["status", "--porcelain"], { capture: true }), "", "Use a clean source checkout.");
  assert(!existsSync(join(appRoot, "ios")), "Use a fresh checkout. Existing native project files were not removed.");
  receipt.toolchain = {
    xcode: run("xcodebuild", ["-version"], { capture: true }), sdk: run("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-version"], { capture: true }),
    node: run("node", ["--version"], { capture: true }), bun: run("bun", ["--version"], { capture: true }),
    cocoapods: run("pod", ["--version"], { capture: true }), ruby: run("ruby", ["--version"], { capture: true }), maestro: run("maestro", ["--version"], { capture: true }),
  };
  assert.match(receipt.toolchain.xcode, /^Xcode 26\.6\nBuild version 17F113$/);
  assert.equal(receipt.toolchain.sdk, "26.5"); assert.equal(receipt.toolchain.node, "v24.12.0");
  assert.equal(receipt.toolchain.bun, "1.4.2"); assert.equal(receipt.toolchain.cocoapods, "1.17.0");
  assert.match(receipt.toolchain.maestro, /2\.10\.0/);
  receipt.bunLockSha256 = hash(readFileSync(join(root, "bun.lock")));
  run("node", ["node_modules/expo/bin/cli", "prebuild", "--platform", "ios", "--no-install"], { cwd: appRoot, log: "prebuild.log" });
  const ios = join(appRoot, "ios"); const sourceLock = join(appRoot, "native/Podfile.lock");
  receipt.bootstrapPodLock = !existsSync(sourceLock);
  if (!receipt.bootstrapPodLock) copyFileSync(sourceLock, join(ios, "Podfile.lock"));
  run("pod", ["install", ...(receipt.bootstrapPodLock ? [] : ["--deployment"])], { cwd: ios, log: "pods.log" });
  copyFileSync(join(ios, "Podfile.lock"), join(output, "Podfile.lock"));
  copyFileSync(join(ios, "Podfile.properties.json"), join(output, "Podfile.properties.json"));
  const workspaces = readdirSync(ios).filter((name) => name.endsWith(".xcworkspace")); assert.equal(workspaces.length, 1);
  const scheme = workspaces[0].slice(0, -".xcworkspace".length);
  const derived = join(tmpdir(), `dice-derived-${process.pid}`);
  run("xcodebuild", ["-workspace", join(ios, workspaces[0]), "-scheme", scheme, "-configuration", "Release", "-sdk", "iphonesimulator",
    "-destination", "generic/platform=iOS Simulator", "-derivedDataPath", derived, "CODE_SIGNING_ALLOWED=NO", "build"], { log: "build.log", timeout: 2400000 });
  const products = join(derived, "Build/Products/Release-iphonesimulator");
  const apps = readdirSync(products).filter((name) => name.endsWith(".app")); assert.equal(apps.length, 1);
  const app = join(products, apps[0]); const info = join(app, "Info.plist");
  const config = JSON.parse(readFileSync(join(appRoot, "app.json"), "utf8")).expo;
  const bundleId = plist(info, "CFBundleIdentifier"); assert.equal(bundleId, config.ios.bundleIdentifier);
  assert.equal(plist(info, "CFBundleShortVersionString"), config.version); assert.equal(plist(info, "CFBundleVersion"), config.ios.buildNumber);
  assert.equal(plist(info, "MinimumOSVersion"), "17.0"); assert(existsSync(join(app, "main.jsbundle")), "Release app must contain its own JS bundle.");
  receipt.app = { bundleId, version: config.version, build: config.ios.buildNumber, minimumOS: "17.0", jsBundleSha256: hash(readFileSync(join(app, "main.jsbundle"))) };
  run("tar", ["-czf", join(output, "unsigned-simulator.app.tar.gz"), "-C", products, apps[0]], { log: "package.log" });
  copyFileSync(info, join(output, "built-Info.plist"));
  assert.equal(run("git", ["status", "--porcelain"], { capture: true }), "", "Prebuild changed tracked source. Review it before qualification.");
  const runtime = "com.apple.CoreSimulator.SimRuntime.iOS-26-5";
  const types = JSON.parse(sim("list", "devicetypes", "--json")).devicetypes;
  const devices = new Map();
  for (const name of new Set(scenarios.map((scenario) => scenario.device))) {
    const type = types.find((item) => item.name === name); assert(type, `Missing simulator type ${name}`);
    const device = sim("create", `Dice-${process.pid}-${name}`, type.identifier, runtime); ownedDevices.push(device); devices.set(name, device);
  }
  let booted = null;
  for (const [index, scenario] of scenarios.entries()) {
    const device = devices.get(scenario.device);
    if (booted !== device) {
      if (booted) sim("shutdown", booted);
      sim("boot", device); sim("bootstatus", device, "-b"); booted = device;
      sim("spawn", device, "defaults", "write", "NSGlobalDomain", "AppleLanguages", "-array", "en");
      sim("spawn", device, "defaults", "write", "NSGlobalDomain", "AppleLocale", "-string", "en_US");
      sim("install", device, app);
    }
    sim("ui", device, "appearance", scenario.appearance);
    sim("ui", device, "content_size", scenario.largeText ? "accessibility-extra-extra-extra-large" : "large");
    sim("status_bar", device, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100");
    const directory = join(output, scenario.id); mkdirSync(directory, { recursive: true });
    const result = { ...scenario, udid: device, runtime, locale: "en-US", status: "running" }; receipt.scenarios.push(result);
    if (index === 0) recording = spawn("xcrun", ["simctl", "io", device, "recordVideo", "--codec=h264", join(directory, "native-resume.mp4")], { env, stdio: "ignore" });
    flow(device, directory, "start", startFlow(bundleId, scenario));
    const before = saved(device, bundleId, directory, "before-relaunch");
    assert.equal(before.data.active.game.diceCount, scenario.dice); assert.equal(before.data.active.game.players.length, scenario.ai + 1);
    assert.deepEqual(before.data.active.game.held, [0]); assert.equal(before.data.active.game.rollsLeft, 1);
    sim("terminate", device, bundleId);
    flow(device, directory, "resume", resumeFlow(bundleId));
    const after = saved(device, bundleId, directory, "after-relaunch"); assert.equal(after.bytes, before.bytes);
    await stopRecording();
    if (!scenario.largeText) {
      flow(device, directory, "complete", completeFlow(bundleId, getScorecardCategories(scenario.dice).map((category) => category.id)));
      const completed = saved(device, bundleId, directory, "completed");
      assert.equal(completed.data.active, null); assert.equal(completed.data.history.entries.length, 1);
      assert.equal(completed.data.highScores.entries.length, scenario.ai + 1);
    }
    result.status = "passed"; result.resumeDocumentSha256 = hash(before.bytes);
    json(join(output, "manifest.json"), receipt);
  }
  // Exercise malformed document preservation through the actual native adapter and reset alert.
  const device = booted; const directory = join(output, "corrupt-save"); mkdirSync(directory);
  const current = saved(device, bundleId, directory, "before-corruption"); sim("terminate", device, bundleId);
  run("sqlite3", [current.database, "UPDATE local_save SET value = 'damaged-save'"], { capture: true });
  flow(device, directory, "corrupt", corruptFlow(bundleId));
  assert.equal(run("sqlite3", ["-readonly", current.database, "SELECT value FROM local_save"], { capture: true }), "damaged-save");
  flow(device, directory, "reset", corruptFlow(bundleId, true));
  const reset = saved(device, bundleId, directory, "after-reset"); assert.equal(reset.data.active, null); assert.equal(reset.data.history.entries.length, 0);
  sim("terminate", device, bundleId);
  run("sqlite3", [reset.database, "PRAGMA wal_checkpoint(TRUNCATE)"], { capture: true });
  const damaged = Buffer.from("Native database corruption fixture. Preserve until explicit reset.");
  writeFileSync(reset.database, damaged);
  flow(device, directory, "corrupt-database", corruptFlow(bundleId));
  assert.deepEqual(readFileSync(reset.database), damaged);
  flow(device, directory, "reset-database", corruptFlow(bundleId, true));
  assert.equal(saved(device, bundleId, directory, "after-database-reset").data.history.entries.length, 0);
  receipt.nativeCorruptionAndReset = "passed";
  receipt.status = receipt.bootstrapPodLock ? "bootstrap-lock-needs-review" : "passed";
} catch (error) {
  receipt.status = "failed"; receipt.error = error instanceof Error ? error.message : String(error); process.exitCode = 1;
  console.error(receipt.error);
} finally {
  try { await stopRecording(); } catch (error) { receipt.recordingError = String(error); receipt.status = "failed"; process.exitCode = 1; }
  for (const device of ownedDevices) {
    // Only devices created by this process are shut down or deleted.
    spawnSync("xcrun", ["simctl", "shutdown", device], { env, stdio: "ignore" });
    const removed = spawnSync("xcrun", ["simctl", "delete", device], { env, stdio: "ignore" });
    if (removed.status !== 0) { (receipt.cleanupErrors ??= []).push(device); receipt.status = "failed"; process.exitCode = 1; }
  }
  receipt.finishedAt = new Date().toISOString(); receipt.artifacts = artifactFiles(output); json(join(output, "manifest.json"), receipt);
}
