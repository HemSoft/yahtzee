import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function redactDriverLog(text, env) {
  let result = text.replace(/(authorization:\s*bearer\s+)\S+/gi, "$1<REDACTED>");
  for (const [name, value] of Object.entries(env)) {
    if (/(token|password|secret|credential|private.*key)/i.test(name) && typeof value === "string" && value.length >= 8) result = result.split(value).join("<REDACTED>");
  }
  return result;
}
/** Retain only the known driver log, not an entire hidden directory or its links. */
export function retainDriverLogs(debug, destination, name, env) {
  const tests = join(debug, ".maestro/tests");
  if (!existsSync(tests) || !lstatSync(tests).isDirectory()) return;
  let index = 0;
  for (const entry of readdirSync(tests, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = join(tests, entry.name, "maestro.log");
    if (!existsSync(source) || !lstatSync(source).isFile()) continue;
    writeFileSync(join(destination, `${name}-driver-${index++}.log`), redactDriverLog(readFileSync(source, "utf8"), env));
  }
}
