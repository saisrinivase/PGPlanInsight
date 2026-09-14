import { describe, expect, test } from "vitest";
import { indexOnlyScanDiagnosis } from "../src/index-only-scan-diagnosis.ts";
import { analyzePlan } from "../src/analyzer.ts";
import { parsePlanInput } from "../src/input-boundary.ts";
import type { PlanVisualNode } from "../src/types.ts";

const scan = (changes: Partial<PlanVisualNode> = {}): PlanVisualNode => ({ rank: 1, depth: 0, path: "1", nodeType: "Index Only Scan", relation: "orders", totalTime: 10, selfTime: 10, timeShare: 1, rows: 100, plannedRows: 100, loops: 1, estimateRatio: 1, tempBlocks: 0, sharedReads: 0, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "customer_id = 42", tempReadBlocks: 0, tempWrittenBlocks: 0, tempReadTime: 0, tempWriteTime: 0, spillRole: null, spillMethod: "", actualTimingCaptured: true, heapFetches: 0, rowsRemovedByFilter: 0, ...changes });

describe("index-only scan diagnosis", () => {
  test("does not diagnose runtime from estimated cost", () => {
    const result = indexOnlyScanDiagnosis(scan({ actualTimingCaptured: false, totalTime: 0, loops: 0, heapFetches: null }));
    expect(result).toMatchObject({ signal: "estimated-only", classification: "unknown", review: false });
    expect(result?.evidence).toMatch(/estimated cost does not prove runtime impact/i);
  });

  test("observes heap-fetch-heavy access", () => {
    const result = indexOnlyScanDiagnosis(scan({ rows: 1_000, heapFetches: 700, sharedReads: 120, loops: 2, totalTime: 240, timeShare: 65 }));
    expect(result).toMatchObject({ signal: "heap-fetch-heavy", classification: "observed", review: true });
    expect(result?.evidence).toMatch(/240 ms \(65\.0% of execution\).*2 loop.*2,000 returned row visits.*120 shared reads.*Heap Fetches 700/i);
  });

  test("observes substantial residual filtering", () => {
    expect(indexOnlyScanDiagnosis(scan({ rows: 100, heapFetches: 0, rowsRemovedByFilter: 2_000 }))).toMatchObject({ signal: "residual-filter", classification: "observed", review: true });
  });

  test("derives material loop amplification from measured time", () => {
    expect(indexOnlyScanDiagnosis(scan({ loops: 3_918, totalTime: 97.95, timeShare: 2.7, heapFetches: 0 }))).toMatchObject({ signal: "effective", review: false });
    expect(indexOnlyScanDiagnosis(scan({ loops: 3_757, totalTime: 3_317.43, timeShare: 90.3, heapFetches: 0 }))).toMatchObject({ signal: "loop-amplified", classification: "derived", review: true });
  });

  test("keeps missing heap-fetch evidence unknown", () => {
    expect(indexOnlyScanDiagnosis(scan({ heapFetches: null }))).toMatchObject({ signal: "incomplete", classification: "unknown", review: false });
  });

  test("preserves measured diagnosis for analyses saved before the capture flag existed", () => {
    expect(indexOnlyScanDiagnosis(scan({ actualTimingCaptured: undefined, heapFetches: undefined, loops: 3_757, totalTime: 3_317.43, timeShare: 90.3 }))).toMatchObject({ signal: "loop-amplified", review: true });
  });

  test("preserves Heap Fetches from TEXT plans", () => {
    const parsed = parsePlanInput("Index Only Scan using orders_customer_idx on orders  (cost=0.42..8.44 rows=1000 width=8) (actual time=0.010..40.000 rows=1000 loops=1)\n  Index Cond: (customer_id = 42)\n  Heap Fetches: 700\nExecution Time: 41.000 ms");
    expect(parsed.Plan["Heap Fetches"]).toBe(700);
  });

  test("emits a measured finding but not an estimated-cost finding", () => {
    const measured = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Index Only Scan", "Relation Name": "orders", "Index Name": "orders_customer_idx", "Plan Rows": 1000, "Actual Rows": 1000, "Actual Loops": 1, "Actual Total Time": 40, "Heap Fetches": 700 }, "Execution Time": 41 }]));
    expect(measured.findings.map((finding) => finding.id)).toContain("IOS-001");
    const estimated = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Index Only Scan", "Relation Name": "orders", "Index Name": "orders_customer_idx", "Plan Rows": 1000, "Total Cost": 999999 } }]));
    expect(estimated.findings.map((finding) => finding.id)).not.toContain("IOS-001");
  });

  test("does not duplicate an index-only loop root cause as a generic CPU finding", () => {
    const result = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Index Only Scan", "Relation Name": "orders", "Index Name": "orders_customer_idx", "Plan Rows": 1, "Actual Rows": 1, "Actual Loops": 2_000, "Actual Total Time": 0.2, "Heap Fetches": 0, "Shared Read Blocks": 20 }, "Execution Time": 400 }]));
    expect(result.findings.map((finding) => finding.id)).toContain("IOS-001");
    expect(result.findings.map((finding) => finding.id)).not.toContain("CPU-001");
    expect(result.primarySignal).toBe("Index-only access");
  });

  test("reports the highest-time index-only review when several scans qualify", () => {
    const result = analyzePlan(JSON.stringify([{ Plan: { "Node Type": "Nested Loop", "Plan Rows": 1, "Actual Rows": 1, "Actual Loops": 1, "Actual Total Time": 500, Plans: [
      { "Node Type": "Index Only Scan", "Relation Name": "small_lookup", "Plan Rows": 100, "Actual Rows": 100, "Actual Loops": 1, "Actual Total Time": 20, "Heap Fetches": 80 },
      { "Node Type": "Index Only Scan", "Relation Name": "repeated_lookup", "Plan Rows": 1, "Actual Rows": 1, "Actual Loops": 2_000, "Actual Total Time": 0.2, "Heap Fetches": 0 },
    ] }, "Execution Time": 500 }]));
    expect(result.findings.find((finding) => finding.id === "IOS-001")?.evidence).toContain("operation 3");
  });
});
