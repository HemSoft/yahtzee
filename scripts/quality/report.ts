import { createCoverageMap, type CoverageMapData, type FileCoverageData } from "istanbul-lib-coverage";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { instrument } from "./instrument";
import { measureFunctions, regressions, type FunctionRisk, type RiskBudget } from "./metrics";
import { exclusions, productionSources, projectRoot, sourceKey } from "./sources";

export function writeRiskReport(): string[] {
  const folder = resolve(projectRoot, "reports/quality");
  const files = productionSources(); const templates = new Map<string, FileCoverageData>();
  const sources = new Map<string, string>(); const coverage = createCoverageMap({});
  for (const path of files) {
    const key = sourceKey(path); const text = readFileSync(path, "utf8"); const template = instrument(text, path).coverage;
    templates.set(key, template); sources.set(key, text); coverage.addFileCoverage(template);
  }
  const rawFiles = readdirSync(resolve(folder, "raw")).filter((file) => file.endsWith(".json"));
  if (!rawFiles.includes("unit.json") || !rawFiles.includes("backend.json") || rawFiles.filter((file) => file.startsWith("client-")).length < 6) {
    throw new Error("Missing unit/backend or client coverage collections");
  }
  for (const rawFile of rawFiles) {
    const raw = JSON.parse(readFileSync(resolve(folder, "raw", rawFile), "utf8")) as CoverageMapData;
    if (!Object.keys(raw).length) throw new Error(`Empty coverage collection: ${rawFile}`);
    for (const [file, data] of Object.entries(raw)) {
      const template = templates.get(file);
      if (!template) throw new Error(`Unexpected source in coverage: ${file}`);
      for (const field of ["fnMap", "branchMap", "statementMap"] as const) {
        if (JSON.stringify(data[field]) !== JSON.stringify(template[field])) throw new Error(`Stale coverage metadata: ${file}`);
      }
    }
    coverage.merge(raw);
  }
  const functions: FunctionRisk[] = [];
  const inventory = files.map((path) => {
    const file = sourceKey(path); const data = coverage.fileCoverageFor(file).data;
    const risks = measureFunctions(file, sources.get(file)!, data); functions.push(...risks);
    return { file, functions: risks.length, entered: risks.filter((fn) => fn.entered).length };
  });
  const byId = (a: FunctionRisk, b: FunctionRisk) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  functions.sort(byId);
  const baseline = JSON.parse(readFileSync(resolve(projectRoot, "quality-baseline.json"), "utf8")) as { version: number; legacy: Record<string, RiskBudget> };
  if (baseline.version !== 1 || !baseline.legacy) throw new Error("Invalid risk baseline");
  const errors = regressions(functions, baseline.legacy);
  const worst = [...functions].sort((a, b) => b.crap - a.crap || byId(a, b));
  const report = {
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim(),
    dirty: !!execFileSync("git", ["status", "--porcelain"], { cwd: projectRoot, encoding: "utf8" }).trim(),
    exclusions, inventory, functions, errors,
  };
  writeFileSync(resolve(folder, "functions.json"), JSON.stringify(functions, null, 2) + "\n");
  writeFileSync(resolve(folder, "report.json"), JSON.stringify(report, null, 2) + "\n");
  const lines = ["# Production function risk", "", `Revision: ${report.commit}. Dirty: ${report.dirty}.`, "",
    `${files.length} files, ${functions.length} concrete functions. All production files are inventoried, including unimported files.`, "",
    "Coverage uses Istanbul branch arms within each function; functions with no branch arms use entry coverage. Review CRAP 15 through 30. New scores above 30 fail; accepted legacy budgets cannot worsen and must shrink after improvement.", "",
    "| Function | Line | Complexity | Coverage basis | Covered / total | CRAP |", "|---|---:|---:|---|---:|---:|",
    ...worst.slice(0, 30).map((fn) => `| ${fn.id.replaceAll("|", "\\|")} | ${fn.line} | ${fn.complexity} | ${fn.coverageBasis} | ${fn.covered}/${fn.total} | ${fn.crap.toFixed(4)} |`), "",
    errors.length ? "## Gate failures\n\n" + errors.map((error) => `- ${error}`).join("\n") : "Gate passed.", ""];
  writeFileSync(resolve(folder, "report.md"), lines.join("\n"));
  console.log(`${files.length} production files, ${functions.length} functions. Highest CRAP ${worst[0]?.crap.toFixed(4)}. ${errors.length} gate failures.`);
  return errors;
}
