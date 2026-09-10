import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";

const textPlan = `PostgreSQL 16.4
Nested Loop  (cost=0.42..25.20 rows=2 width=16) (actual time=0.030..13.200 rows=2 loops=1)
  Buffers: shared hit=12 read=140
  ->  Seq Scan on customers  (cost=0.00..20.00 rows=2 width=8) (actual time=0.010..12.000 rows=2 loops=1)
        Filter: (lower(email) = 'a@example.com')
        Rows Removed by Filter: 50000
        Buffers: shared hit=10 read=140
  ->  Index Scan using orders_customer_idx on orders  (cost=0.42..2.50 rows=1 width=8) (actual time=0.010..0.020 rows=1 loops=2)
        Index Cond: (customer_id = customers.id)
        Buffers: shared hit=2
Planning Time: 0.400 ms
Execution Time: 13.400 ms`;

describe("input normalization", () => {
  test("parses PostgreSQL TEXT into the canonical analysis model", () => {
    const result = analyzePlan(textPlan);
    expect(result.format).toBe("TEXT"); expect(result.postgresMajor).toBe(16);
    expect(result.nodeCount).toBe(3); expect(result.executionTime).toBe(13.4);
    expect(result.planMap[1].nodeType).toBe("Seq Scan"); expect(result.planMap[2].relation).toBe("orders");
    expect(result.findings.map((finding) => finding.id)).toContain("PATH-001");
  });

  test("normalizes known JSON field aliases and worker arrays", () => {
    const source = JSON.stringify([{ "PostgreSQL Version": "18devel", Plan: { "Node Type": "Gather", "Actual Total Time": 4, "Actual Rows": 2, "Actual Loops": 1, "Plan Rows": 2, "Shared Blocks Read": 12, Workers: [{}, {}] }, "Execution Time": 4 }]);
    const result = analyzePlan(source);
    expect(result.postgresMajor).toBe(18); expect(result.adapter).toContain("18");
    expect(result.planMap[0].sharedReads).toBe(12); expect(result.planMap[0].workersLaunched).toBe(2);
  });

  test("rejects arbitrary non-plan text", () => expect(() => analyzePlan("hello world")).toThrow(/TEXT plan/));

  test("accepts quoted clipboard TEXT with escaped identifiers and parallel scans", () => {
    const source = readFileSync(new URL("./quoted-parallel-plan.txt", import.meta.url), "utf8");
    const result = analyzePlan(source);
    expect(result.format).toBe("TEXT"); expect(result.nodeCount).toBe(3); expect(result.executionTime).toBe(280.534);
    expect(result.planMap[2].nodeType).toBe("Parallel Seq Scan"); expect(result.planMap[2].relation).toBe("ds_local.wam_index_eis");
    expect(result.metrics.maxRowsRemoved).toBe(18_960_648); expect(result.metrics.workersLaunched).toBe(2);
    expect(result.findings.map((finding) => finding.id)).toContain("PATH-001"); expect(result.primarySignal).toBe("Access path");
    expect(result.settings.some((setting) => setting.name === "work_mem" && setting.value === "128MB")).toBe(true);
  });

  test("accepts a one-line quoted production export with non-breaking spaces", () => {
    const source = readFileSync(new URL("./production-nested-loop-plan.txt", import.meta.url), "utf8");
    const result = analyzePlan(source);
    expect(result.format).toBe("TEXT");
    expect(result.executionTime).toBe(60_969.666);
    expect(result.nodeCount).toBeGreaterThan(20);
    expect(result.planMap[0].nodeType).toBe("Nested Loop Semi Join");
    expect(result.planMap.some((node) => node.nodeType === "Parallel Seq Scan" && node.relation === "erasapp.application")).toBe(true);
    expect(result.metrics.rootTempBlocks).toBe(184_808);
    expect(result.metrics.rootSharedReads).toBe(0);
    expect(result.planMap[0].spillRole).toBe("inherited");
    const spillSource = result.planMap.find((node) => node.spillRole === "direct");
    expect(spillSource?.nodeType).toBe("Sort");
    expect(spillSource?.spillMethod).toMatch(/external merge/i);
    expect((spillSource?.tempReadTime ?? 0) + (spillSource?.tempWriteTime ?? 0)).toBeCloseTo(426.45, 2);
    const spillFinding = result.findings.find((finding) => finding.id === "MEM-001");
    expect(spillFinding?.title).toBe("Direct spill at Sort");
    expect(spillFinding?.detail).toMatch(/426\.45 ms.*before calling the spill dominant/i);
  });

  test("analyzes TEXT plans with more than 2,000 logical lines without truncation", () => {
    const children = Array.from({ length: 999 }, (_, index) => [
      `  ->  Index Scan using events_pkey on events_${index + 1}  (cost=0.10..1.00 rows=1 width=8) (actual time=0.001..0.002 rows=1 loops=1)`,
      `        Index Cond: (id = ${index + 1})`,
    ]).flat();
    const source = [
      "Append  (cost=0.00..999.00 rows=999 width=8) (actual time=0.001..2.500 rows=999 loops=1)",
      ...children,
      "Planning Time: 2.000 ms",
      "Execution Time: 2.600 ms",
    ].join("\n");

    expect(source.split("\n").length).toBeGreaterThan(2_000);
    const result = analyzePlan(source);
    expect(result.format).toBe("TEXT");
    expect(result.nodeCount).toBe(1_000);
    expect(result.planMap.at(-1)?.relation).toBe("events_999");
    expect(result.executionTime).toBe(2.6);
  });
});
