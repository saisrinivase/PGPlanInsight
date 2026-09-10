import { describe, expect, test } from "vitest";
import { statisticsDiagnosis } from "../src/statistics-diagnosis.ts";
import type { DatabaseContext } from "../src/database-context.ts";
import type { PlanVisualNode } from "../src/types.ts";

const node = (changes: Partial<PlanVisualNode> = {}): PlanVisualNode => ({ rank: 1, depth: 2, path: "1.1.1", nodeType: "Index Scan", relation: "public.orders", totalTime: 100, selfTime: 100, timeShare: 50, rows: 10_000, plannedRows: 100, loops: 1, estimateRatio: 100, tempBlocks: 0, sharedReads: 0, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "(customer_id = 42)", tempReadBlocks: 0, tempWrittenBlocks: 0, tempReadTime: 0, tempWriteTime: 0, spillRole: null, spillMethod: "", expressions: [{ source: "Index Cond", text: "((customer_id = 42) AND (status = 'OPEN'::text))" }], ...changes });
const context = (changes: Partial<DatabaseContext["relations"][number]> = {}, availability: Partial<DatabaseContext["availability"]> = {}): DatabaseContext => ({ version: 2, provenance: { collectedAt: "2026-09-01T00:00:00Z", postgresVersion: "18.3", collector: "pgplan-context-sql", collectorVersion: "2", redacted: true }, availability: { relationStats: { status: "captured" }, columnStats: { status: "captured" }, indexStats: { status: "captured" }, extendedStats: { status: "captured" }, partitions: { status: "unavailable" }, settings: { status: "captured" }, ...availability }, settings: [], relations: [{ schema: "public", name: "orders", liveTuples: 1_000_000, modificationsSinceAnalyze: 10_000, columns: [{ name: "customer_id", type: "bigint", statisticsTarget: 100 }, { name: "status", type: "text", statisticsTarget: 100 }], indexes: [], extendedStatistics: [], ...changes }] });

describe("statistics diagnosis", () => {
  test("selects the deepest row-producing divergence instead of a pass-through symptom", () => {
    const result = statisticsDiagnosis([node({ depth: 0, path: "1", nodeType: "Sort", estimateRatio: 1000 }), node({ depth: 3, path: "1.1.1.1", estimateRatio: 20 })], null);
    expect(result.node?.path).toBe("1.1.1.1");
  });
  test("keeps plan-only statistics cause unknown", () => expect(statisticsDiagnosis([node()], null)).toMatchObject({ signal: "plan-only", classification: "unknown" }));
  test("qualifies modification pressure without claiming proven stale statistics", () => {
    const result = statisticsDiagnosis([node()], context({ modificationsSinceAnalyze: 300_000 }));
    expect(result).toMatchObject({ signal: "modification-pressure", classification: "suspected" });
    expect(result.unknown).toMatch(/does not prove/i);
  });
  test("suggests a controlled extended-statistics experiment only when no covering object exists", () => {
    expect(statisticsDiagnosis([node()], context())).toMatchObject({ signal: "extended-statistics-candidate", classification: "suspected" });
    const result = statisticsDiagnosis([node()], context({ extendedStatistics: [{ name: "orders_customer_status", columns: ["customer_id", "status"], kinds: ["dependencies", "mcv"] }] }));
    expect(result).toMatchObject({ signal: "extended-statistics-present", classification: "observed" });
    expect(result.summary).toMatch(/do not recommend a duplicate/i);
  });
  test("keeps unavailable catalog sections and unmatched relations unknown", () => {
    expect(statisticsDiagnosis([node()], context({}, { columnStats: { status: "unavailable" } }))).toMatchObject({ signal: "context-incomplete", classification: "unknown" });
    expect(statisticsDiagnosis([node({ relation: "public.missing" })], context())).toMatchObject({ signal: "relation-not-found", classification: "unknown" });
  });
  test("does not invent a statistics problem below the material drift threshold", () => expect(statisticsDiagnosis([node({ estimateRatio: 4 })], context())).toMatchObject({ signal: "no-material-drift", classification: "observed", node: null }));
});
