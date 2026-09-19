import { createInstrumenter } from "istanbul-lib-instrument";
import type { FileCoverageData } from "istanbul-lib-coverage";
import { sourceKey } from "./sources";

export function instrument(source: string, path: string): { code: string; coverage: FileCoverageData } {
  const instance = createInstrumenter({
    esModules: true, coverageGlobalScope: "globalThis", coverageGlobalScopeFunc: false,
    parserPlugins: ["typescript", ...(/\.[jt]sx$/.test(path) ? ["jsx"] : [])],
  });
  const code = instance.instrumentSync(source, sourceKey(path));
  return { code, coverage: instance.lastFileCoverage() };
}
