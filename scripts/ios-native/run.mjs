import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { getScorecardCategories } from "../../packages/game-engine/src/presentation.ts";
import { decodeSave } from "../../apps/mobile/src/local/save.ts";
import { startFlow, resumeFlow, completeFlow, corruptFlow, emptyRelaunchFlow, scenarios, GROUPS, scenariosForGroup } from "./flows.mjs";
import { buildSimulator } from "./build.mjs";
import { loadBuiltSimulator } from "./artifact.mjs";
import { retainDriverLogs } from "./driverLogs.mjs";

assert.equal(process.platform, "darwin", "Native qualification requires macOS, Xcode and iOS simulators.");
assert(["arm64", "x64"].includes(process.arch), "Unsupported simulator host architecture.");
const architecture = process.arch === "arm64" ? "arm64" : "x86_64";
const args = process.argv.slice(2);
assert(args.every((arg) => ["--build-only", "--refresh-pods", ...GROUPS.map((group) => `--test-group=${group}`)].includes(arg)), "Unknown native qualification argument.");
const groupArgs = args.filter((arg) => arg.startsWith("--test-group=")); assert(groupArgs.length <= 1);
const group = groupArgs[0]?.slice("--test-group=".length);
const refreshPodLock = args.includes("--refresh-pods");
const buildOnly = args.includes("--build-only") || refreshPodLock;
assert(!(group && buildOnly), "Build and test-only modes cannot be combined.");
const selectedScenarios = group ? scenariosForGroup(group) : scenarios;
const root = resolve(import.meta.dirname, "../..");
const output = join(root, "reports/native");
assert(!existsSync(output), "Use a fresh checkout. Existing native evidence was not overwritten.");
mkdirSync(output, { recursive: true });
const env = { ...process.env, DEVELOPER_DIR: "/Applications/Xcode_26.6.app/Contents/Developer", EXPO_NO_TELEMETRY: "1",
  MAESTRO_CLI_NO_ANALYTICS: "true", MAESTRO_DISABLE_UPDATE_CHECK: "true", MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true", MAESTRO_DRIVER_STARTUP_TIMEOUT: "300000" };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
function run(executable, commandArgs, { cwd = root, capture = false, timeout = 1800000, log = "commands.log" } = {}) {
  console.log(`$ ${executable} ${commandArgs.join(" ")}`);
  const fd = openSync(join(output, log), "a");
  let result;
  try { result = spawnSync(executable, commandArgs, { cwd, env, encoding: "utf8", timeout, killSignal: "SIGKILL", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", capture ? "pipe" : fd, fd] }); }
  finally { closeSync(fd); }
  if (capture && result.stdout) appendFileSync(join(output, log), result.stdout);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${executable} failed with ${result.status}; see ${log}`);
  return result.stdout?.trim() ?? "";
}
const sim = (...commandArgs) => run("xcrun", ["simctl", ...commandArgs], { capture: true, timeout: commandArgs[0] === "bootstatus" ? 600000 : 180000 });
const receipt = { schemaVersion: 1, kind: buildOnly ? "unsigned-ios-simulator-build" : "unsigned-ios-simulator-tests", status: "running", source: run("git", ["rev-parse", "HEAD"], { capture: true }),
  startedAt: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  runnerImage: process.env.ImageVersion ?? null, architecture, group: group ?? null, scenarios: [],
  limits: ["Not a signed device archive", "Not TestFlight or physical-device evidence", "No airplane-mode or VoiceOver acceptance claim", "Public identity and release approvals remain unset", "Raw hidden debug trees are excluded; selected driver logs are sanitized and retained"] };
const checkpoint = () => json(join(output, "manifest.json"), receipt);
checkpoint();
const ownedDevices = [];
let recording = null;
async function stopRecording() {
  if (!recording) return;
  const child = recording; recording = null;
  if (child.exitCode !== null) { assert.equal(child.exitCode, 0, "Simulator recording exited with an error."); return; }
  const stopped = new Promise((done) => child.once("close", done));
  const controller = new AbortController();
  child.kill("SIGINT");
  try { await Promise.race([stopped, delay(15000, undefined, { signal: controller.signal }).then(() => { child.kill("SIGKILL"); throw new Error("Simulator recording did not stop."); })]); }
  finally { controller.abort(); }
}
function flow(device, directory, name, content) {
  const file = join(directory, `${name}.yaml`); writeFileSync(file, content);
  const debug = join(directory, `${name}-debug`);
  try {
    run("maestro", ["--device", device, "test", "--test-output-dir", join(directory, name), "--debug-output", debug,
      "--format", "JUNIT", "--output", join(directory, `${name}.xml`), file], { timeout: 600000, log: `${name}-${directory.split(/[\\/]/).at(-1)}.log` });
  } finally { retainDriverLogs(debug, directory, name, env); }
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
    if (entry.name.startsWith(".")) return [];
    const relative = prefix + entry.name; const path = join(directory, entry.name);
    if (entry.isDirectory()) return artifactFiles(path, relative + "/");
    if (!entry.isFile() || relative === "manifest.json") return [];
    return [{ path: relative, bytes: statSync(path).size, sha256: hash(readFileSync(path)) }];
  });
}
function corruption(device, bundleId) {
  const directory = join(output, "corrupt-save"); mkdirSync(directory);
  const current = saved(device, bundleId, directory, "before-corruption"); sim("terminate", device, bundleId);
  run("sqlite3", [current.database, "UPDATE local_save SET value = 'damaged-save'"], { capture: true });
  flow(device, directory, "corrupt", corruptFlow(bundleId));
  assert.equal(run("sqlite3", ["-readonly", current.database, "SELECT value FROM local_save"], { capture: true }), "damaged-save");
  flow(device, directory, "reset", corruptFlow(bundleId, true));
  assert(!existsSync(current.database), "Confirmed reset must remove the damaged database.");
  flow(device, directory, "reset-relaunch", emptyRelaunchFlow(bundleId));
  const reset = saved(device, bundleId, directory, "after-reset"); assert.equal(reset.data.active, null); assert.equal(reset.data.history.entries.length, 0);
  sim("terminate", device, bundleId);
  run("sqlite3", [reset.database, "PRAGMA wal_checkpoint(TRUNCATE)"], { capture: true });
  const damaged = Buffer.from("Native database corruption fixture. Preserve until explicit reset.");
  writeFileSync(reset.database, damaged);
  flow(device, directory, "corrupt-database", corruptFlow(bundleId));
  assert.deepEqual(readFileSync(reset.database), damaged);
  flow(device, directory, "reset-database", corruptFlow(bundleId, true));
  assert(!existsSync(reset.database), "Confirmed reset must remove the damaged database.");
  flow(device, directory, "reset-database-relaunch", emptyRelaunchFlow(bundleId));
  assert.equal(saved(device, bundleId, directory, "after-database-reset").data.history.entries.length, 0);
  receipt.nativeCorruptionAndReset = "passed";
}
async function exercise(app, bundleId) {
  const runtime = "com.apple.CoreSimulator.SimRuntime.iOS-26-5";
  const types = JSON.parse(sim("list", "devicetypes", "--json")).devicetypes;
  const devices = new Map();
  for (const name of new Set(selectedScenarios.map((scenario) => scenario.device))) {
    const type = types.find((item) => item.name === name); assert(type, `Missing simulator type ${name}`);
    const device = sim("create", `Dice-${process.pid}-${name}`, type.identifier, runtime); ownedDevices.push(device); devices.set(name, device);
  }
  let booted = null;
  for (const [index, scenario] of selectedScenarios.entries()) {
    const device = devices.get(scenario.device);
    receipt.phase = `prepare-${scenario.id}`; checkpoint();
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
    receipt.phase = `start-${scenario.id}`; checkpoint();
    if (index === 0) recording = spawn("xcrun", ["simctl", "io", device, "recordVideo", "--codec=h264", join(directory, "native-resume.mp4")], { env, stdio: "ignore" });
    flow(device, directory, "start", startFlow(bundleId, scenario));
    const before = saved(device, bundleId, directory, "before-relaunch");
    assert.equal(before.data.active.game.diceCount, scenario.dice); assert.equal(before.data.active.game.players.length, scenario.ai + 1);
    assert.deepEqual(before.data.active.game.held, [0]); assert.equal(before.data.active.game.rollsLeft, 1);
    sim("terminate", device, bundleId);
    receipt.phase = `resume-${scenario.id}`; checkpoint();
    flow(device, directory, "resume", resumeFlow(bundleId));
    const after = saved(device, bundleId, directory, "after-relaunch"); assert.equal(after.bytes, before.bytes);
    if (!scenario.largeText) {
      receipt.phase = `complete-${scenario.id}`; checkpoint();
      const preview = ["phone-5-solo-light", "tablet-8-solo-light"].includes(scenario.id);
      flow(device, directory, "complete", completeFlow(bundleId, getScorecardCategories(scenario.dice).map((category) => category.id), preview));
      const completed = saved(device, bundleId, directory, "completed");
      assert.equal(completed.data.active, null); assert.equal(completed.data.history.entries.length, 1);
      assert.equal(completed.data.highScores.entries.length, scenario.ai + 1);
    }
    await stopRecording();
    result.status = "passed"; result.resumeDocumentSha256 = hash(before.bytes); checkpoint();
  }
  if (!group || group === "tablet-10") { receipt.phase = "corruption-and-reset"; checkpoint(); corruption(booted, bundleId); }
  assert.equal(receipt.scenarios.length, selectedScenarios.length);
  assert(receipt.scenarios.every((scenario) => scenario.status === "passed"));
}
try {
  assert.equal(run("git", ["status", "--porcelain"], { capture: true }), "", "Use a clean source checkout.");
  receipt.toolchain = {
    xcode: run("xcodebuild", ["-version"], { capture: true }), sdk: run("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-version"], { capture: true }),
    node: run("node", ["--version"], { capture: true }), bun: run("bun", ["--version"], { capture: true }),
    cocoapods: run("pod", ["--version"], { capture: true }), ruby: run("ruby", ["--version"], { capture: true }),
    maestro: buildOnly ? null : run("maestro", ["--version"], { capture: true }),
  };
  assert.match(receipt.toolchain.xcode, /^Xcode 26\.6\nBuild version 17F113$/);
  assert.equal(receipt.toolchain.sdk, "26.5"); assert.equal(receipt.toolchain.node, "v24.12.0");
  assert.equal(receipt.toolchain.bun, "1.4.2"); assert.equal(receipt.toolchain.cocoapods, "1.17.0");
  if (!buildOnly) assert.match(receipt.toolchain.maestro, /2\.10\.0/);
  receipt.bunLockSha256 = hash(readFileSync(join(root, "bun.lock")));
  receipt.phase = group ? "verify-built-app" : "build"; checkpoint();
  const context = { root, output, run, hash, receipt, architecture, refreshPodLock };
  const { app, bundleId } = group ? loadBuiltSimulator(context) : buildSimulator(context);
  checkpoint();
  if (!buildOnly) await exercise(app, bundleId);
  receipt.phase = "complete"; receipt.status = "passed";
} catch (error) {
  receipt.status = "failed"; receipt.error = error instanceof Error ? error.message : String(error); process.exitCode = 1;
  for (const scenario of receipt.scenarios) if (scenario.status === "running") scenario.status = "failed";
  console.error(receipt.error);
} finally {
  try { await stopRecording(); } catch (error) { receipt.recordingError = String(error); receipt.status = "failed"; process.exitCode = 1; }
  for (const device of ownedDevices) {
    // Only devices created by this process are shut down or deleted.
    spawnSync("xcrun", ["simctl", "shutdown", device], { env, stdio: "ignore", timeout: 60000, killSignal: "SIGKILL" });
    const removed = spawnSync("xcrun", ["simctl", "delete", device], { env, stdio: "ignore", timeout: 60000, killSignal: "SIGKILL" });
    if (removed.status !== 0) { (receipt.cleanupErrors ??= []).push(device); receipt.status = "failed"; process.exitCode = 1; }
  }
  receipt.finishedAt = new Date().toISOString(); receipt.artifacts = artifactFiles(output); checkpoint();
}
