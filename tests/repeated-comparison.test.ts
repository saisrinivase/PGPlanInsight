import { expect, test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";
import { buildRepeatedReport, compareRepeatedAnalyses, summarizeRuns } from "../src/repeated-comparison.ts";
const declared = { sameStatement: true, sameParameters: true, comparableEnvironment: true, repeatedCapture: true };
const run = (time: number | null, extra: object = {}, settings: object = {}) => analyzePlan(JSON.stringify({ Plan: { "Node Type": "Seq Scan", "Relation Name": "orders", "Actual Total Time": time ?? 1, "Actual Rows": 10, "Actual Loops": 1, "Plan Rows": 10, ...extra }, ...(time == null ? {} : { "Execution Time": time }), Settings: settings }));
const runs = (values: number[], extra: object = {}) => values.map((value) => run(value, extra));

test("medians and MAD use every submitted run, including outliers", () => {
  expect(summarizeRuns(runs([100, 105, 10_000]))).toMatchObject({ count: 3, measured: 3, median: 105, min: 100, max: 10_000 });
  expect(summarizeRuns(runs([100, 110, 120, 130])).median).toBe(115);
  expect(summarizeRuns(runs([1e308, 1e308, 1e308, 1e308])).median).toBe(1e308);
});
test("stable repeated improvement uses medians; resource absence stays unknown", () => {
  const result = compareRepeatedAnalyses(runs([100, 110, 120]), runs([40, 50, 60]), declared);
  expect(result.verdict).toBe("Improved");
  expect(result.runtimeDeltaPercent).toBeCloseTo(-54.545, 2);
  expect(result.metrics.find((row) => row.label === "Root shared reads")).toMatchObject({ before: null, after: null });
  expect(result.comparability.find((check) => check.id === "resources")?.status).toBe("warning");
});
test("one capture per side cannot be approved by checking repeated", () => {
  const result = compareRepeatedAnalyses(runs([100]), runs([20]), declared);
  expect(result.verdict).toBe("Inconclusive");
  expect(result.comparability.find((check) => check.id === "repeat")?.status).toBe("blocker");
});
test("a missing runtime is not silently dropped from the median", () => {
  const result = compareRepeatedAnalyses([run(100), run(null), run(110)], runs([20, 25, 30]), declared);
  expect(result.verdict).toBe("Inconclusive");
  expect(result.runs.before).toMatchObject({ measured: 2, count: 3, median: null });
});
test("unconfirmed conditions, zero baseline and large variability block success", () => {
  expect(compareRepeatedAnalyses(runs([100, 110, 120]), runs([20, 25, 30]), { ...declared, sameParameters: false }).verdict).toBe("Inconclusive");
  expect(compareRepeatedAnalyses(runs([0, 0, 0]), runs([0, 0, 0]), declared).verdict).toBe("Inconclusive");
  expect(compareRepeatedAnalyses(runs([100, 200, 300]), runs([10, 15, 20]), declared).comparability.find((check) => check.id === "variation")?.status).toBe("blocker");
});
test("overlapping ranges prevent declaring an improvement from one fast median", () => {
  const result = compareRepeatedAnalyses(runs([90, 100, 110]), runs([10, 20, 105]), declared);
  expect(result.verdict).toBe("Inconclusive");
  expect(result.comparability.find((check) => check.id === "overlap")?.status).toBe("blocker");
});
test("setting drift in a nonrepresentative sample overrides declarations", () => {
  const result = compareRepeatedAnalyses([run(100, {}, { work_mem: "4MB" }), run(110, {}, { work_mem: "4MB" }), run(120, {}, { work_mem: "64MB" })], runs([40, 50, 60]), declared);
  expect(result.verdict).toBe("Inconclusive");
  expect(result.comparability.find((check) => check.id === "environment")?.detail).toContain("work_mem");
});
test("resource medians, including a zero baseline, block a faster-but-more-expensive fix", () => {
  for (const metric of ["Shared Read Blocks", "Temp Written Blocks", "WAL Bytes"]) {
    const result = compareRepeatedAnalyses(runs([100, 105, 110], { [metric]: 0 }), runs([40, 45, 50], { [metric]: 100 }), declared);
    expect(result.verdict).toBe("Inconclusive");
    expect(result.comparability.find((check) => check.id === "resources")?.status).toBe("blocker");
  }
});
test("stable slowdown and small changes receive their own verdicts", () => {
  expect(compareRepeatedAnalyses(runs([40, 45, 50]), runs([100, 105, 110]), declared).verdict).toBe("Regressed");
  expect(compareRepeatedAnalyses(runs([100, 101, 102]), runs([102, 103, 104]), declared).verdict).toBe("No material runtime change");
});
test("changed result rows block attribution and capture limits reject oversized sets", () => {
  expect(compareRepeatedAnalyses(runs([100, 105, 110]), runs([40, 45, 50], { "Actual Rows": 5 }), declared).verdict).toBe("Inconclusive");
  expect(() => compareRepeatedAnalyses([], runs([1]), declared)).toThrow(/1 and 10/);
  expect(() => compareRepeatedAnalyses(runs(Array(11).fill(1)), runs([1]), declared)).toThrow(/1 and 10/);
});
test("export includes samples, missing evidence and limitations without hiding outliers", () => {
  const before = runs([100, 110, 10_000]), after = runs([40, 50, 60]);
  const report = buildRepeatedReport(before[0], after[0], compareRepeatedAnalyses(before, after, declared));
  expect(report).toContain("10000");
  expect(report).toContain("N/A");
  expect(report).toContain("Locks, concurrency, cache state and production-wide benefit remain unverified");
});
