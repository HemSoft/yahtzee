import assert from "node:assert/strict";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { localMaestro } from "./mcp.mjs";
import { redactDriverLog } from "./driverLogs.mjs";

/** One bounded local driver session for the owned simulator. */
export async function nativeInteraction({ device, bundleId, directory, prefix, env, capture, exercise }) {
  assert(["complete", "hold"].includes(prefix), "Unknown native interaction phase.");
  let diagnostics = "", sequence = 0;
  const deadline = Date.now() + 600000;
  const childEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
    /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TMP|TEMP|JAVA_HOME|DEVELOPER_DIR|LANG|LC_ALL|MAESTRO_CLI_NO_ANALYTICS|MAESTRO_DISABLE_UPDATE_CHECK|MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED|MAESTRO_DRIVER_STARTUP_TIMEOUT)$/.test(key)));
  let client;
  async function call(name, args) { assert(Date.now() < deadline, "Native interaction exceeded ten minutes."); return client.call(name, args); }
  async function inspect() {
    const screen = await call("inspect_screen", { device_id: device });
    writeFileSync(join(directory, `${prefix}-screen-latest.json`), JSON.stringify(screen, null, 2) + "\n");
    return screen;
  }
  async function run(commands) {
    const yaml = `appId: ${JSON.stringify(bundleId)}\n---\n` + commands.map((command) => {
      const [[name, value]] = Object.entries(command); return `- ${name}: ${JSON.stringify(value)}`;
    }).join("\n") + "\n";
    writeFileSync(join(directory, `${prefix}-step-${String(++sequence).padStart(3, "0")}.yaml`), yaml);
    const result = await call("run", { device_id: device, yaml });
    assert.equal(result.success, true, "Native interaction command failed.");
  }
  try {
    client = await localMaestro({ cwd: directory, env: childEnv, deadline, onStderr: (text) => { diagnostics += text.slice(0, Math.max(0, 262144 - diagnostics.length)); } });
    const devices = await call("list_devices", {});
    assert(devices.devices?.some((item) => item.device_id === device && item.platform === "ios" && item.connected === true), "Owned simulator is not connected to Maestro.");
    await exercise({ inspect, run, capture, record: (value) => appendFileSync(join(directory, `${prefix}-geometry.jsonl`), JSON.stringify(value) + "\n") });
  } catch (error) {
    try { await capture(`${prefix}-failure`); } catch { /* Preserve the original error; the runner also reads the saved document. */ }
    throw error;
  } finally {
    try { await client?.close(); }
    finally { writeFileSync(join(directory, `${prefix}-mcp.log`), redactDriverLog(diagnostics, env)); }
  }
}
