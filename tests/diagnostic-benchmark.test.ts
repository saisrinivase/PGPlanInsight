import { test, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { analyzePlan } from "../src/analyzer.ts";
import { scoreDecisions } from "../scripts/diagnostic-score.mjs";

// Synthetic regression labels. NOT independent DBA ground truth or a holdout set.
const cases = [
  { id: "heap-heavy", family: "index-only", finding: "IOS-001", expected: "positive", measured: true, fields: { "Heap Fetches": 700 } },
  { id: "heap-zero", family: "index-only", finding: "IOS-001", expected: "negative", measured: true, fields: { "Heap Fetches": 0 } },
  { id: "cost-not-runtime", family: "index-only", finding: "IOS-001", expected: "unknown", measured: false, fields: { "Total Cost": 999999 } },
  { id: "missing-runtime", family: "capture", finding: "EV-001", expected: "positive", measured: false, fields: {} },
  { id: "captured-runtime", family: "capture", finding: "EV-001", expected: "negative", measured: true, fields: {} },
] as const;

test("synthetic diagnostic benchmark remains conformant", () => {
  const decisions = cases.map(c => {
    const result = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Index Only Scan", "Relation Name": "orders", "Plan Rows": 1000,
      ...(c.measured ? { "Actual Rows": 1000, "Actual Loops": 1, "Actual Total Time": 40 } : {}), ...c.fields },
      ...(c.measured ? { "Execution Time": 41 } : {}) }]));
    const found = result.findings.some(f => f.id === c.finding);
    const missingRuntime = result.findings.some(f => f.id === "EV-001");
    return { id: c.id, family: c.family, expected: c.expected, actual: found ? "positive" : c.family === "index-only" && missingRuntime ? "unknown" : "negative" };
  });
  const report = { schemaVersion: 1, corpus: "synthetic-regression-v1", independentDbaReviewed: false, productionAccuracy: null,
    scope: "Selected finding decisions only; not whole-plan correctness or recommendation safety", total: scoreDecisions(decisions),
    families: Object.fromEntries([...new Set(decisions.map(d => d.family))].map(f => [f, scoreDecisions(decisions.filter(d => d.family === f))])), decisions };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/diagnostic-score.json", JSON.stringify(report, null, 2));
  expect(report.total.mismatches).toEqual([]);
});

test("scoring catches false positives, misses and unsafe non-abstention", () => {
  const report = scoreDecisions([
    { id: "a", expected: "positive", actual: "positive" },
    { id: "b", expected: "negative", actual: "positive" },
    { id: "c", expected: "positive", actual: "unknown" },
    { id: "d", expected: "unknown", actual: "positive" },
  ]);
  expect(report).toMatchObject({ precision: 0.5, recall: 0.5, falsePositiveRate: 1, safeAbstentionRate: 0 });
  expect(report.mismatches).toEqual(["b", "c", "d"]);
  expect(scoreDecisions([{ id: "u", expected: "unknown", actual: "unknown" }]).precision).toBeNull();
  expect(() => scoreDecisions([])).toThrow();
  expect(() => scoreDecisions([{ id: "x", expected: "bad", actual: "positive" }])).toThrow();
  expect(() => scoreDecisions([{ id: "x", expected: "negative", actual: "negative" }, { id: "x", expected: "negative", actual: "negative" }])).toThrow();
});
