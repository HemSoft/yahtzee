import { calculateMetrics } from "mutation-testing-metrics";
import type { MutationTestResult } from "mutation-testing-report-schema";

const statuses = new Set(["Killed", "Timeout", "Survived", "NoCoverage", "CompileError", "RuntimeError", "Ignored", "Pending"]);

export function summarize(report: MutationTestResult, expectedFiles?: readonly string[]) {
  if (!report?.files || !Object.keys(report.files).length) throw new Error("Missing mutation files");
  if (expectedFiles && JSON.stringify(Object.keys(report.files).sort()) !== JSON.stringify([...expectedFiles].sort())) {
    throw new Error("Mutation scope changed or is incomplete");
  }
  for (const [file, data] of Object.entries(report.files)) {
    if (typeof data.source !== "string" || !Array.isArray(data.mutants) || !data.mutants.length) throw new Error(`Missing mutants: ${file}`);
    for (const mutant of data.mutants) {
      if (!statuses.has(mutant.status)) throw new Error(`Unknown mutant status: ${mutant.status}`);
      if (mutant.status === "Ignored" && mutant.mutatorName !== "StringLiteral") throw new Error(`Undeclared suppression: ${file}/${mutant.id}`);
    }
  }
  const metrics = calculateMetrics(report.files).metrics;
  if (!metrics.totalValid || !Number.isFinite(metrics.mutationScore) || metrics.pending || metrics.runtimeErrors) {
    throw new Error("Mutation run is empty, incomplete or has runtime errors");
  }
  const survivors = Object.entries(report.files).flatMap(([file, data]) => data.mutants
    .filter((mutant) => mutant.status === "Survived" || mutant.status === "NoCoverage")
    .map((mutant) => ({ file, id: mutant.id, line: mutant.location.start.line, operator: mutant.mutatorName, replacement: mutant.replacement })));
  return { metrics, survivors };
}

export function mutationGate(report: MutationTestResult, threshold: number, expectedFiles?: readonly string[]) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) throw new Error("Invalid mutation threshold");
  const summary = summarize(report, expectedFiles);
  return { ...summary, passed: summary.metrics.mutationScore >= threshold };
}
