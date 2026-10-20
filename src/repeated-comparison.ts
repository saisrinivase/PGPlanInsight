import type { Analysis } from "./types.ts";
import { buildComparisonReport, compareAnalyses, type ComparisonAttestation, type PlanComparison } from "./compare.ts";

export const MAX_COMPARISON_RUNS = 10;
export interface RunSummary {
  count: number; measured: number; median: number | null; min: number | null; max: number | null;
  madPercent: number | null; values: Array<number | null>;
}
export interface RepeatedComparison extends PlanComparison {
  runs: { before: RunSummary; after: RunSummary };
  representativeEvidence: { beforeScore: number; afterScore: number; beforeAdapter: string; afterAdapter: string };
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] + (sorted[middle] - sorted[middle - 1]) / 2;
};
export function summarizeRuns(runs: Analysis[]): RunSummary {
  const values = runs.map((run) => run.executionTime);
  const measured = values.filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const center = measured.length && measured.length === runs.length ? median(measured) : null;
  return { count: runs.length, measured: measured.length, median: center,
    min: measured.length ? Math.min(...measured) : null, max: measured.length ? Math.max(...measured) : null,
    madPercent: center != null && center > 0 ? median(measured.map((value) => Math.abs(value - center))) / center * 100 : null, values };
}
export function compareRepeatedAnalyses(beforeRuns: Analysis[], afterRuns: Analysis[], attestation: ComparisonAttestation): RepeatedComparison {
  if (!beforeRuns.length || !afterRuns.length || beforeRuns.length > MAX_COMPARISON_RUNS || afterRuns.length > MAX_COMPARISON_RUNS) throw new Error("Supply between 1 and 10 captures per side.");
  const before = summarizeRuns(beforeRuns), after = summarizeRuns(afterRuns);
  const representative = (runs: Analysis[]) => [...runs].sort((a, b) => (a.executionTime ?? Infinity) - (b.executionTime ?? Infinity))[Math.floor(runs.length / 2)];
  const oldPlan = representative(beforeRuns), newPlan = representative(afterRuns);
  const result: RepeatedComparison = { ...compareAnalyses(oldPlan, newPlan, attestation), runs: { before, after }, representativeEvidence: { beforeScore: oldPlan.score, afterScore: newPlan.score, beforeAdapter: oldPlan.adapter, afterAdapter: newPlan.adapter } };
  result.runtimeDeltaPercent = before.median == null || after.median == null || before.median === 0 ? null : (after.median - before.median) / before.median * 100;
  if (result.runtimeDeltaPercent != null && !Number.isFinite(result.runtimeDeltaPercent)) result.runtimeDeltaPercent = null;
  const repeat = result.comparability.find((check) => check.id === "repeat")!;
  repeat.status = before.count >= 3 && after.count >= 3 && attestation.repeatedCapture ? "pass" : "blocker";
  repeat.detail = `${before.count} before / ${after.count} after captures submitted. At least 3 independent captures per side and the operator declaration are required; a checkbox alone cannot establish an improvement. Independence is not verified from plan text.`;
  const runtime = result.comparability.find((check) => check.id === "runtime")!;
  runtime.status = result.runtimeDeltaPercent == null ? "blocker" : "pass";
  runtime.detail = `${before.measured}/${before.count} before and ${after.measured}/${after.count} after captures include runtime. Every capture needs Execution Time; a positive baseline median is required.`;
  const all = [...beforeRuns, ...afterRuns];
  const drift = ["work_mem", "random_page_cost", "effective_cache_size", "max_parallel_workers_per_gather", "jit"].filter((name) => new Set(all.flatMap((run) => run.settings.filter((setting) => setting.name.toLowerCase() === name).map((setting) => setting.value))).size > 1);
  if (drift.length) {
    const environment = result.comparability.find((check) => check.id === "environment")!;
    environment.status = "blocker"; environment.detail = `Captured settings differ across submitted runs: ${drift.join(", ")}.`;
  }
  result.comparability.push({ id: "variation", label: "Runtime variation", status: [before, after].some((group) => (group.madPercent ?? 0) > 20) ? "blocker" : "pass", detail: "Median absolute deviation above 20% of the median blocks a verdict. This is a screening rule, not statistical significance; review ranges and individual runs." });
  if (before.min != null && before.max != null && after.min != null && after.max != null && Math.max(before.min, after.min) <= Math.min(before.max, after.max) && Math.abs(result.runtimeDeltaPercent ?? 0) >= 10) result.comparability.push({ id: "overlap", status: "blocker", label: "Overlapping runtime ranges", detail: "Before and after ranges overlap despite the median change. Collect more representative runs; a faster median alone is not sufficient." });
  const aggregate = (runs: Analysis[], get: (run: Analysis) => number | null) => {
    const values = runs.map(get);
    return values.every((value) => value != null && Number.isFinite(value)) ? median(values as number[]) : null;
  };
  result.metrics = result.metrics.map((row) => {
    const get = row.label === "Execution time (ms)" ? (run: Analysis) => run.executionTime
      : row.label === "Root shared reads" ? (run: Analysis) => run.metricCapture?.rootBuffers ? run.metrics.rootSharedReads : null
      : row.label === "Root temporary blocks" ? (run: Analysis) => run.metricCapture?.rootBuffers ? run.metrics.rootTempBlocks : null
      : row.label === "Root WAL bytes" ? (run: Analysis) => run.metricCapture?.rootWal ? run.metrics.rootWalBytes : null
      : row.label === "Root actual rows" ? (run: Analysis) => run.metricCapture?.rootRows ? run.planMap[0]?.rows ?? null : null
      : row.label === "Root planned rows" ? (run: Analysis) => run.metricCapture?.rootPlanRows ? run.planMap[0]?.plannedRows ?? null : null
      : (run: Analysis) => run.nodeCount;
    const oldValue = aggregate(beforeRuns, get), newValue = aggregate(afterRuns, get);
    return { ...row, before: oldValue, after: newValue, delta: oldValue == null || newValue == null || oldValue === 0 ? null : (newValue - oldValue) / oldValue * 100 };
  });
  const resources = result.metrics.filter((row) => ["Root shared reads", "Root temporary blocks", "Root WAL bytes"].includes(row.label));
  const regressions = resources.filter((row) => row.before != null && row.after != null && row.after > row.before * 1.1);
  result.comparability.push({ id: "resources", label: "Resource regression review", status: regressions.length ? "blocker" : resources.some((row) => row.before == null || row.after == null) ? "warning" : "pass", detail: regressions.length ? `Median resource use increased by more than 10% (including increases from zero): ${regressions.map((row) => row.label).join(", ")}. Review the trade-off before accepting the fix.` : "Missing counters remain N/A, not zero. Medians describe root inclusive counters, not unique disk pages or summed node work." });
  const rows = result.metrics.find((row) => row.label === "Root actual rows")!;
  const capturedRows = all.filter((run) => run.metricCapture?.rootRows).map((run) => run.planMap[0].rows);
  if (new Set(capturedRows).size > 1) result.comparability.push({ id: "rows", label: "Returned rows changed", status: "blocker", detail: "Returned rows differ across submitted captures. Verify equivalent results and data before attributing the runtime change to the fix." });
  if (rows.before == null || rows.after == null) result.comparability.push({ id: "row-evidence", label: "Result equivalence unknown", status: "warning", detail: "Actual output rows were not captured in every run. Runtime does not prove equivalent query results." });
  if (new Set(all.flatMap((run) => run.postgresMajor ? [run.postgresMajor] : [])).size > 1) result.comparability.push({ id: "versions", label: "Versions across captures", status: "warning", detail: "Submitted captures include different PostgreSQL major versions." });
  const shapeCount = (runs: Analysis[]) => new Set(runs.map((run) => JSON.stringify(run.planMap.map((node) => [node.path, node.nodeType, node.relation, node.predicate])))).size;
  if (shapeCount(beforeRuns) > 1 || shapeCount(afterRuns) > 1) result.comparability.push({ id: "plan-stability", label: "Plan stability", status: "warning", detail: "A capture group contains different plan shapes or predicates. Inspect all plans; the structural comparison shows only the median-runtime representative per side." });
  result.comparable = !result.comparability.some((check) => check.status === "blocker");
  result.verdict = !result.comparable || result.runtimeDeltaPercent == null ? "Inconclusive" : result.runtimeDeltaPercent <= -10 ? "Improved" : result.runtimeDeltaPercent >= 10 ? "Regressed" : "No material runtime change";
  return result;
}
export function buildRepeatedReport(before: Analysis, after: Analysis, result: RepeatedComparison): string {
  const summary = (label: string, group: RunSummary) => `${label}: ${group.count} submitted, ${group.measured} measured; median ${group.median ?? "N/A"} ms; range ${group.min ?? "N/A"}–${group.max ?? "N/A"} ms; relative MAD ${group.madPercent?.toFixed(1) ?? "N/A"}%\nRuns (ms): ${group.values.map((value) => value ?? "N/A").join(", ")}`;
  const evidence = result.representativeEvidence;
  return buildComparisonReport({ ...before, score: evidence.beforeScore, adapter: evidence.beforeAdapter }, { ...after, score: evidence.afterScore, adapter: evidence.afterAdapter }, result) + "\n## Repeated captures\n\n" + summary("Before", result.runs.before) + "\n\n" + summary("After", result.runs.after) + "\n\nMetrics are per-side medians; structural changes and evidence scores use representative captures only. Minimum 3 runs, 10% material-change/resource and 20% MAD thresholds are screening rules, not statistical confidence or DBA-certified accuracy. No samples are removed. Identical files do not prove independent executions. Locks, concurrency, cache state and production-wide benefit remain unverified.\n";
}
