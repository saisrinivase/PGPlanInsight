import type { Analysis } from "./types.ts";

export type ComparisonVerdict = "Improved" | "Regressed" | "No material runtime change" | "Inconclusive";
export interface ComparisonAttestation { sameStatement: boolean; sameParameters: boolean; comparableEnvironment: boolean; repeatedCapture: boolean }
export interface ComparabilityCheck { id: string; status: "pass" | "warning" | "blocker"; label: string; detail: string }

export interface PlanComparison {
  verdict: ComparisonVerdict;
  runtimeDeltaPercent: number | null;
  evidenceDelta: number;
  metrics: Array<{ label: string; before: number | null; after: number | null; delta: number | null }>;
  accessPathChanges: Array<{ path: string; before: string; after: string; confidence: "high" | "medium" | "unmatched" }>;
  comparability: ComparabilityCheck[];
  comparable: boolean;
}

const percentDelta = (before: number | null, after: number | null): number | null => before == null || after == null || before === 0 ? null : (after - before) / before * 100;

const relevantSettings = ["work_mem", "random_page_cost", "effective_cache_size", "max_parallel_workers_per_gather", "jit"];

export function compareAnalyses(before: Analysis, after: Analysis, attestation: ComparisonAttestation = { sameStatement: false, sameParameters: false, comparableEnvironment: false, repeatedCapture: false }): PlanComparison {
  const runtimeDeltaPercent = percentDelta(before.executionTime, after.executionTime);
  const beforeSettings = new Map(before.settings.map((setting) => [setting.name.toLowerCase(), setting.value]));
  const afterSettings = new Map(after.settings.map((setting) => [setting.name.toLowerCase(), setting.value]));
  const changedSettings = relevantSettings.filter((name) => beforeSettings.has(name) && afterSettings.has(name) && beforeSettings.get(name) !== afterSettings.get(name));
  const comparability: ComparabilityCheck[] = [
    { id: "statement", status: attestation.sameStatement ? "pass" : "blocker", label: "Same SQL shape", detail: attestation.sameStatement ? "User confirmed the same statement/query shape." : "Confirm that before and after represent the same SQL shape." },
    { id: "parameters", status: attestation.sameParameters ? "pass" : "blocker", label: "Representative parameters", detail: attestation.sameParameters ? "User confirmed equivalent representative parameter values." : "Parameter selectivity can change the plan and runtime independently of the tested fix." },
    { id: "environment", status: attestation.comparableEnvironment && !changedSettings.length ? "pass" : "blocker", label: "Comparable environment", detail: changedSettings.length ? `Captured planner/runtime settings changed: ${changedSettings.join(", ")}.` : attestation.comparableEnvironment ? "User confirmed comparable settings, cache state, and concurrency." : "Confirm comparable settings, cache state, and concurrency." },
    { id: "repeat", status: attestation.repeatedCapture ? "pass" : "blocker", label: "Repeated result", detail: attestation.repeatedCapture ? "User confirmed the result was repeated under representative conditions." : "A single execution is provisional and cannot establish an improvement. Repeat under representative conditions." },
    { id: "runtime", status: runtimeDeltaPercent == null ? "blocker" : "pass", label: "Measured runtime", detail: runtimeDeltaPercent == null ? "Execution Time is required in both captures." : "Both plans include measured execution time." },
    { id: "version", status: before.postgresMajor && after.postgresMajor && before.postgresMajor !== after.postgresMajor ? "warning" : "pass", label: "PostgreSQL version", detail: before.postgresMajor && after.postgresMajor && before.postgresMajor !== after.postgresMajor ? `PostgreSQL ${before.postgresMajor} is being compared with PostgreSQL ${after.postgresMajor}.` : "No captured major-version conflict." },
  ];
  const comparable = !comparability.some((check) => check.status === "blocker");
  const verdict: ComparisonVerdict = !comparable || runtimeDeltaPercent == null ? "Inconclusive" : runtimeDeltaPercent <= -10 ? "Improved" : runtimeDeltaPercent >= 10 ? "Regressed" : "No material runtime change";
  const unused = new Set(after.planMap.map((_, index) => index));
  const accessPathChanges: PlanComparison["accessPathChanges"] = [];
  for (const oldNode of before.planMap) {
    let best: { index: number; score: number } | null = null;
    for (const index of unused) {
      const candidate = after.planMap[index];
      let score = 0;
      if (candidate.nodeType === oldNode.nodeType) score += 5;
      if (candidate.relation !== "—" && candidate.relation === oldNode.relation) score += 6;
      if (candidate.predicate && candidate.predicate === oldNode.predicate) score += 4;
      score += Math.max(0, 2 - Math.abs(candidate.depth - oldNode.depth));
      if (!best || score > best.score) best = { index, score };
    }
    if (!best || best.score < 5) { accessPathChanges.push({ path: oldNode.path, before: oldNode.nodeType, after: "Removed", confidence: "unmatched" }); continue; }
    unused.delete(best.index);
    const newNode = after.planMap[best.index];
    if (oldNode.nodeType !== newNode.nodeType || oldNode.path !== newNode.path) accessPathChanges.push({ path: oldNode.path === newNode.path ? oldNode.path : `${oldNode.path} → ${newNode.path}`, before: oldNode.nodeType, after: newNode.nodeType, confidence: best.score >= 11 ? "high" : "medium" });
  }
  for (const index of unused) { const node = after.planMap[index]; accessPathChanges.push({ path: node.path, before: "Added", after: node.nodeType, confidence: "unmatched" }); }
  return {
    verdict, runtimeDeltaPercent, evidenceDelta: after.score - before.score, accessPathChanges, comparability, comparable,
    metrics: [
      { label: "Execution time (ms)", before: before.executionTime, after: after.executionTime, delta: runtimeDeltaPercent },
      { label: "Root shared reads", before: before.metrics.rootSharedReads, after: after.metrics.rootSharedReads, delta: percentDelta(before.metrics.rootSharedReads, after.metrics.rootSharedReads) },
      { label: "Root temporary blocks", before: before.metrics.rootTempBlocks, after: after.metrics.rootTempBlocks, delta: percentDelta(before.metrics.rootTempBlocks, after.metrics.rootTempBlocks) },
      { label: "Root WAL bytes", before: before.metrics.rootWalBytes, after: after.metrics.rootWalBytes, delta: percentDelta(before.metrics.rootWalBytes, after.metrics.rootWalBytes) },
      { label: "Root actual rows", before: before.planMap[0]?.rows ?? null, after: after.planMap[0]?.rows ?? null, delta: percentDelta(before.planMap[0]?.rows ?? null, after.planMap[0]?.rows ?? null) },
      { label: "Root planned rows", before: before.planMap[0]?.plannedRows ?? null, after: after.planMap[0]?.plannedRows ?? null, delta: percentDelta(before.planMap[0]?.plannedRows ?? null, after.planMap[0]?.plannedRows ?? null) },
      { label: "Plan nodes", before: before.nodeCount, after: after.nodeCount, delta: percentDelta(before.nodeCount, after.nodeCount) },
    ],
  };
}

export function buildComparisonReport(before: Analysis, after: Analysis, comparison: PlanComparison): string {
  const delta = (value: number | null) => value == null ? "N/A" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  return [`# PGPlan Insight DBA Fix Validation`, "", `Verdict: **${comparison.verdict}**`, `Runtime delta: ${delta(comparison.runtimeDeltaPercent)}`, `Evidence: ${before.score}/100 → ${after.score}/100`, `Adapters: ${before.adapter} → ${after.adapter}`, "", "## Comparability gate", "", ...comparison.comparability.map((check) => `- **${check.status.toUpperCase()} · ${check.label}:** ${check.detail}`), "", "## Metrics", "", "| Metric | Before | After | Delta |", "|---|---:|---:|---:|", ...comparison.metrics.map((row) => `| ${row.label} | ${row.before ?? "N/A"} | ${row.after ?? "N/A"} | ${delta(row.delta)} |`), "", "## Structurally matched plan changes", "", ...(comparison.accessPathChanges.length ? comparison.accessPathChanges.map((row) => `- ${row.path}: ${row.before} → ${row.after} (${row.confidence} match)` ) : ["- No structural node-type change after identity matching."]), "", "## Guardrail", "", comparison.comparable ? "This comparison passed the declared comparability gate. Repeat under representative workload before production approval." : "Comparability blockers remain. Do not claim improvement or regression.", ""].join("\n");
}
