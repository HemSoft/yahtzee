import assert from "node:assert/strict";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scorePosition, assertRecorded, screenElements } from "./geometry.mjs";
import { localMaestro } from "./mcp.mjs";
import { redactDriverLog } from "./driverLogs.mjs";

export async function scoreCategories({ categories, inspect, run, capture, record }) {
  assert(categories.length > 0 && categories.length <= 20 && new Set(categories).size === categories.length);
  await run([{ launchApp: { stopApp: false, clearState: false, permissions: { all: "deny" } } }]);
  for (const [index, id] of categories.entries()) {
    assert(/^[a-z][a-z0-9-]*$/.test(id), "Invalid score identifier.");
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await run([{ waitForAnimationToEnd: { timeout: 5000 } }]);
      const decision = scorePosition(await inspect(), id, categories); record({ index, attempt, ...decision });
      if (decision.action === "tap") { ready = true; break; }
      if (decision.action === "swipe") await run([{ swipe: { start: decision.start, end: decision.end, duration: decision.duration } }]);
    }
    assert(ready, `Score ${id} did not become reachable within 30 inspections.`);
    await capture(`score-${id}-ready`);
    const last = index === categories.length - 1;
    await run([{ tapOn: { id: `score-${id}`, enabled: true, retryTapIfNoChange: false } },
      { extendedWaitUntil: { visible: last ? { text: "Game Over!" } : { id: `score-${id}`, text: ".* points recorded.*" }, timeout: 15000 } }]);
    const after = await inspect();
    if (last) assert(screenElements(after).some((node) => node.a11y === "Game Over!" || node.txt === "Game Over!"), "Native game did not finish.");
    else assertRecorded(after, id);
    record({ index, id, action: "acknowledged", last });
  }
}

/** Local-only transport around the pinned Maestro driver. No cloud calls or extra service. */
export async function nativeScoring({ device, bundleId, directory, categories, env, capture }) {
  let diagnostics = "", sequence = 0;
  const deadline = Date.now() + 600000;
  const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
    /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TMP|TEMP|JAVA_HOME|DEVELOPER_DIR|LANG|LC_ALL|MAESTRO_CLI_NO_ANALYTICS|MAESTRO_DISABLE_UPDATE_CHECK|MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED|MAESTRO_DRIVER_STARTUP_TIMEOUT)$/.test(key)));
  let client;
  async function call(name, args) { assert(Date.now() < deadline, "Native scoring exceeded ten minutes."); return client.call(name, args); }
  async function inspect() {
    const screen = await call("inspect_screen", { device_id: device });
    writeFileSync(join(directory, "complete-screen-latest.json"), JSON.stringify(screen, null, 2) + "\n");
    return screen;
  }
  async function run(commands) {
    const yaml = `appId: ${JSON.stringify(bundleId)}\n---\n` + commands.map((command) => {
      const [[name, value]] = Object.entries(command); return `- ${name}: ${JSON.stringify(value)}`;
    }).join("\n") + "\n";
    writeFileSync(join(directory, `complete-step-${String(++sequence).padStart(3, "0")}.yaml`), yaml);
    const result = await call("run", { device_id: device, yaml });
    assert.equal(result.success, true, "Native scoring command failed.");
  }
  try {
    client = await localMaestro({ cwd: directory, env: childEnv, deadline, onStderr: (text) => { diagnostics += text.slice(0, Math.max(0, 262144 - diagnostics.length)); } });
    const devices = await call("list_devices", {});
    assert(devices.devices?.some((item) => item.device_id === device && item.platform === "ios" && item.connected === true), "Owned simulator is not connected to Maestro.");
    await scoreCategories({ categories, inspect, run, capture, record: (value) => appendFileSync(join(directory, "complete-geometry.jsonl"), JSON.stringify(value) + "\n") });
  } catch (error) {
    try { await capture("complete-failure"); } catch { /* Preserve the original failure; the runner also attempts a read-only save snapshot. */ }
    throw error;
  } finally {
    try { await client?.close(); }
    finally { writeFileSync(join(directory, "complete-mcp.log"), redactDriverLog(diagnostics, env)); }
  }
}
