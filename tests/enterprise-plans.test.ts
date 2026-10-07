import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";
import { compareAnalyses } from "../src/compare.ts";

const plan = (name: string) => analyzePlan(readFileSync(new URL(`./enterprise_plans/${name}.json`, import.meta.url), "utf8"));
const sample = (name: string) => JSON.parse(readFileSync(new URL(`../public/samples/${name}.json`, import.meta.url), "utf8"));

describe("enterprise pgbench diagnosis gate", () => {
  test("healthy index lookup does not invent planning or access problems", () => {
    const result = plan("01_indexed_point_lookup");
    expect(result.score).toBe(100);
    expect(result.primarySignal).toBe("No dominant risk detected");
    expect(result.findings.map((finding) => finding.id)).toEqual(["BASE-001"]);
  });

  test("non-sargable expression confirms estimate and filtering evidence", () => {
    expect(plan("02_non_sargable_expression").findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["EST-001", "PATH-001"]));
  });

  test("broad low-selectivity scan is not automatically called defective", () => {
    expect(plan("03_low_selectivity_filter").findings.map((finding) => finding.id)).toEqual(["BASE-001"]);
  });

  test("missing history support identifies high-volume filtering", () => {
    expect(plan("04_missing_history_index_join").findings.map((finding) => finding.id)).toContain("PATH-001");
  });

  test("prioritizes the qualifying scan with the most measured rows removed, not first tree order", () => {
    const result = analyzePlan(JSON.stringify([{ Plan: {
      "Node Type": "Append", "Actual Total Time": 120, "Actual Rows": 1000, "Actual Loops": 1, Plans: [
        { "Node Type": "Seq Scan", "Relation Name": "first_scan", "Actual Total Time": 100, "Actual Rows": 1000, "Actual Loops": 1, "Rows Removed by Filter": 12000, "Plan Rows": 1000, "Shared Read Blocks": 2000 },
        { "Node Type": "Seq Scan", "Relation Name": "more_filtered", "Actual Total Time": 10, "Actual Rows": 100, "Actual Loops": 1, "Rows Removed by Filter": 80000, "Plan Rows": 100, "Shared Read Blocks": 10 },
      ],
    }, "Execution Time": 120 }]));
    const finding = result.findings.find((item) => item.id === "PATH-001");

    expect(finding?.nodePath).toBe("1.2");
    expect(finding?.detail).toContain("more_filtered recorded 80,000 rows removed");
    expect(finding?.detail).toContain("prioritized by filtered-row count, then captured shared reads and node time to break ties");
    expect(finding?.detail).toContain("investigation-priority signals, not a runtime-cost ranking");
  });

  test("uses captured reads then node time as deterministic tie-breakers for equal filter counts", () => {
    const result = analyzePlan(JSON.stringify([{ Plan: {
      "Node Type": "Append", "Actual Total Time": 100, "Actual Rows": 1000, "Actual Loops": 1, Plans: [
        { "Node Type": "Seq Scan", "Relation Name": "more_reads", "Actual Total Time": 20, "Actual Rows": 100, "Actual Loops": 1, "Rows Removed by Filter": 20000, "Plan Rows": 100, "Shared Read Blocks": 300 },
        { "Node Type": "Seq Scan", "Relation Name": "less_reads", "Actual Total Time": 30, "Actual Rows": 100, "Actual Loops": 1, "Rows Removed by Filter": 20000, "Plan Rows": 100, "Shared Read Blocks": 10 },
        { "Node Type": "Seq Scan", "Relation Name": "same_reads_slower", "Actual Total Time": 40, "Actual Rows": 100, "Actual Loops": 1, "Rows Removed by Filter": 20000, "Plan Rows": 100, "Shared Read Blocks": 300 },
      ],
    }, "Execution Time": 100 }]));
    const finding = result.findings.find((item) => item.id === "PATH-001");

    expect(finding?.nodePath).toBe("1.3");
    expect(finding?.detail).toContain("same_reads_slower recorded 20,000 rows removed");
  });

  test("twenty correlated rescans qualify as measured loop amplification", () => {
    const result = plan("05_correlated_loop_amplification");
    expect(result.primarySignal).toBe("CPU loop amplification");
    expect(result.findings.map((finding) => finding.id)).toContain("CPU-001");
  });

  test("external sort reports root temporary I/O", () => {
    const result = plan("06_external_sort_spill");
    expect(result.primarySignal).toBe("Memory / spill");
    expect(result.metrics.rootTempBlocks).toBe(57093);
  });

  test("hash spill exposes batch count", () => {
    const result = plan("07_hash_aggregate_spill");
    expect(result.metrics.maxHashBatches).toBe(1365);
    expect(result.findings[0].detail).toContain("1,365 hash batches");
  });

  test("captured zero parallel setting drives parallelism diagnosis", () => {
    const result = plan("08_parallelism_suppressed");
    expect(result.primarySignal).toBe("Parallelism");
    expect(result.findings.map((finding) => finding.id)).toContain("PAR-001");
  });

  test("forced JIT thresholds do not invent unmeasured JIT overhead", () => {
    const result = plan("09_jit_overhead_small_query");
    expect(result.primarySignal).toBe("No dominant risk detected");
  });

  test("modifying root reports material WAL", () => {
    const result = plan("10_wal_heavy_update_rollback");
    expect(result.primarySignal).toBe("WAL / write pressure");
    expect(result.metrics.rootWalBytes).toBeGreaterThan(1_000_000);
  });

  test("expression selectivity drift remains evidence-backed", () => {
    expect(plan("11_expression_estimate_drift").findings.map((finding) => finding.id)).toEqual(expect.arrayContaining(["EST-001", "PATH-001"]));
  });

  test("large OFFSET is detected from child-to-limit row ratio", () => {
    const result = plan("12_large_offset_pagination");
    expect(result.primarySignal).toBe("Pagination work");
    expect(result.findings.map((finding) => finding.id)).toContain("PAGE-001");
  });

  test("comparison rejects small changes and reports structural shifts", () => {
    const before = plan("02_non_sargable_expression");
    const after = plan("01_indexed_point_lookup");
    const comparison = compareAnalyses(before, after, { sameStatement: true, sameParameters: true, comparableEnvironment: true, repeatedCapture: true });
    expect(comparison.verdict).toBe("Improved");
    expect(comparison.runtimeDeltaPercent).toBeLessThan(-90);
    expect(comparison.accessPathChanges.length).toBeGreaterThan(0);
  });

  test("bind-loop churn sample stays realistic while preserving amplification", () => {
    const source = sample("real_bind_loop_churn_plan");
    const nodes: Array<Record<string, unknown>> = [];
    const collect = (node: Record<string, unknown>) => {
      nodes.push(node);
      for (const child of (node.Plans as Array<Record<string, unknown>> | undefined) ?? []) collect(child);
    };
    collect(source[0].Plan);
    const loopCounts = nodes.map((node) => Number(node["Actual Loops"] ?? 0));
    const hitBlocks = nodes.map((node) => Number(node["Shared Hit Blocks"] ?? 0));
    expect(source[0]["Execution Time"]).toBeGreaterThan(1_000);
    expect(source[0]["Execution Time"]).toBeLessThan(10_000);
    expect(Math.max(...loopCounts)).toBe(10_284);
    expect(Math.max(...hitBlocks)).toBeLessThan(100_000);
    expect(nodes.filter((node) => node["Node Type"] === "Index Only Scan").map((node) => node["Actual Loops"])).toEqual([10_284, 10_284]);
    expect(Number(source[0].Plan["Actual Total Time"])).toBeGreaterThanOrEqual(Number(source[0].Plan.Plans[0]["Actual Total Time"]));
  });
});
