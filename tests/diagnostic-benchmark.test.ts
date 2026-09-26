import { test, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { analyzePlan } from "../src/analyzer.ts";
import { scoreDecisions } from "../scripts/diagnostic-score.mjs";
import { indexOnlyScanDiagnosis } from "../src/index-only-scan-diagnosis.ts";
import { typeCoercionDiagnosis } from "../src/type-coercion-diagnosis.ts";

const castCases = [
  { id: "join-column-double", fields: { "Hash Cond": "((a.id)::double precision = b.id)" }, signal: "predicate-coercion", classification: "observed", boundary: "does not prove" },
  { id: "filter-column-numeric", fields: { Filter: "((id)::numeric = 42)" }, signal: "predicate-coercion", classification: "observed", boundary: "does not prove" },
  { id: "typed-constant-only", fields: { Filter: "id = '42'::bigint" }, signal: "none", classification: "observed", boundary: "may still contain" },
  { id: "plain-equality", fields: { "Hash Cond": "a.id = b.id" }, signal: "none", classification: "observed", boundary: "may still contain" },
  { id: "missing-expressions", fields: {}, signal: "none", classification: "observed", boundary: "may still contain" },
  { id: "output-only-cast", fields: { Output: ["(id)::double precision"] }, signal: "output-coercion", classification: "observed", boundary: "does not establish" },
  { id: "append-output-hypothesis", fields: { Output: ["(id)::double precision"] }, append: true, signal: "set-operation-output", classification: "suspected", boundary: "does not identify" },
] as const;

const accessCases = [
  { id: "repeated-expensive-probes", expected: "positive", signal: "loop-amplified", execution: 400, fields: { "Actual Rows": 1, "Actual Loops": 2000, "Actual Total Time": 0.2, "Heap Fetches": 0 }, explanation: "do not create another index" },
  { id: "repeated-cheap-probes", expected: "negative", signal: "effective", execution: 1000, fields: { "Actual Rows": 1, "Actual Loops": 2000, "Actual Total Time": 0.001, "Heap Fetches": 0 }, explanation: "avoided heap visits" },
  { id: "residual-filter-work", expected: "positive", signal: "residual-filter", execution: 100, fields: { "Actual Rows": 10, "Actual Loops": 2, "Actual Total Time": 10, "Rows Removed by Filter": 1000, "Heap Fetches": 0 }, explanation: "residual filter" },
  { id: "missing-heap-evidence", expected: "unknown", signal: "incomplete", execution: 100, fields: { "Actual Rows": 10, "Actual Loops": 1, "Actual Total Time": 1 }, explanation: "not captured" },
  { id: "reads-not-heap-fetches", expected: "negative", signal: "effective", execution: 1000, fields: { "Actual Rows": 1000, "Actual Loops": 1, "Actual Total Time": 100, "Shared Read Blocks": 5000, "Heap Fetches": 0 }, explanation: "avoided heap visits" },
  { id: "heap-counters-not-multiplied", expected: "negative", signal: "effective", execution: 1000, fields: { "Actual Rows": 1, "Actual Loops": 20, "Actual Total Time": 0.001, "Shared Read Blocks": 12, "Heap Fetches": 0 }, explanation: "12 shared reads" },
] as const;

// Synthetic regression labels. NOT independent DBA ground truth or a holdout set.
const cases = [
  { id: "heap-heavy", family: "index-only", finding: "IOS-001", expected: "positive", measured: true, fields: { "Heap Fetches": 700 } },
  { id: "heap-zero", family: "index-only", finding: "IOS-001", expected: "negative", measured: true, fields: { "Heap Fetches": 0 } },
  { id: "cost-not-runtime", family: "index-only", finding: "IOS-001", expected: "unknown", measured: false, fields: { "Total Cost": 999999 } },
  { id: "missing-runtime", family: "capture", finding: "EV-001", expected: "positive", measured: false, fields: {} },
  { id: "captured-runtime", family: "capture", finding: "EV-001", expected: "negative", measured: true, fields: {} },
] as const;

test("synthetic diagnostic benchmark remains conformant", () => {
  const decisions: { id: string; family: string; expected: string; actual: string }[] = cases.map(c => {
    const result = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Index Only Scan", "Relation Name": "orders", "Plan Rows": 1000,
      ...(c.measured ? { "Actual Rows": 1000, "Actual Loops": 1, "Actual Total Time": 40 } : {}), ...c.fields },
      ...(c.measured ? { "Execution Time": 41 } : {}) }]));
    const found = result.findings.some(f => f.id === c.finding);
    const missingRuntime = result.findings.some(f => f.id === "EV-001");
    return { id: c.id, family: c.family, expected: c.expected, actual: found ? "positive" : c.family === "index-only" && missingRuntime ? "unknown" : "negative" };
  });
  const accessResults = accessCases.map(c => {
    const result = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Index Only Scan", "Relation Name": "orders", "Index Name": "orders_existing_idx", "Plan Rows": c.fields["Actual Rows"], ...c.fields }, "Execution Time": c.execution }]));
    const diagnosis = indexOnlyScanDiagnosis(result.planMap[0])!;
    return { id: c.id, family: "existing-index-access", expected: c.expected, actual: diagnosis.review ? "positive" : diagnosis.classification === "unknown" ? "unknown" : "negative",
      expectedSignal: c.signal, signal: diagnosis.signal, explanationMatches: `${diagnosis.summary} ${diagnosis.evidence} ${diagnosis.nextAction}`.includes(c.explanation) };
  });
  decisions.push(...accessResults);
  const castResults = castCases.map(c => {
    const leaf = { "Node Type": "Seq Scan", "Relation Name": "orders", "Plan Rows": 10, ...c.fields };
    const plan = "append" in c ? { "Node Type": "Append", "Plan Rows": 10, Plans: [leaf] } : leaf;
    const result = analyzePlan(JSON.stringify([{ Plan: plan }]));
    const diagnosis = typeCoercionDiagnosis(result.planMap, null);
    return { id: c.id, family: "visible-cast-detection", expected: c.signal === "none" ? "negative" : "positive", actual: diagnosis.signal === "none" ? "negative" : "positive",
      expectedSignal: c.signal, signal: diagnosis.signal,
      explanationMatches: diagnosis.classification === c.classification && diagnosis.unknown.includes(c.boundary) };
  });
  decisions.push(...castResults);
  const report = { schemaVersion: 1, corpus: "synthetic-regression-v3", independentDbaReviewed: false, productionAccuracy: null,
    scope: "Selected finding decisions only; not whole-plan correctness or recommendation safety", total: scoreDecisions(decisions),
    families: Object.fromEntries([...new Set(decisions.map(d => d.family))].map(f => [f, scoreDecisions(decisions.filter(d => d.family === f))])), decisions,
    explanationFailures: [...accessResults, ...castResults].filter(r => r.signal !== r.expectedSignal || !r.explanationMatches).map(r => r.id) };
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/diagnostic-score.json", JSON.stringify(report, null, 2));
  expect(report.total.mismatches).toEqual([]);
  expect(report.explanationFailures).toEqual([]);
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
