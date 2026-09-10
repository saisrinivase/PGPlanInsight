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
