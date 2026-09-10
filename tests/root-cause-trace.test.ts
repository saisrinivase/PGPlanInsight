import { describe, expect, test } from "vitest";
import { rootCauseTrace } from "../src/root-cause-trace.ts";
import type { PlanVisualNode } from "../src/types.ts";

const node = (path: string, depth: number, nodeType: string, values: Partial<PlanVisualNode> = {}): PlanVisualNode => ({ rank: 1, path, depth, nodeType, relation: "—", totalTime: 100, selfTime: 5, timeShare: 50, rows: 1_545, plannedRows: 1, loops: 1, estimateRatio: 1545, tempBlocks: 0, sharedReads: 0, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "", ...values });

describe("root-cause tracing", () => {
  test("traces inherited Sort cardinality drift to the deepest evidenced child", () => {
    const nodes = [node("1", 0, "Sort"), node("1.1", 1, "Nested Loop"), node("1.1.1", 2, "Seq Scan")];
    const trace = rootCauseTrace(nodes, nodes[0]);
    expect(trace?.kind).toBe("cardinality");
    expect(trace?.chain.map((item) => item.nodeType)).toEqual(["Sort", "Nested Loop", "Seq Scan"]);
    expect(trace?.origin.nodeType).toBe("Seq Scan");
  });

  test("stops where child evidence no longer crosses the drift threshold", () => {
    const parent = node("1", 0, "Hash Join");
    const child = node("1.1", 1, "Seq Scan", { estimateRatio: 2 });
    expect(rootCauseTrace([parent, child], parent)?.origin.nodeType).toBe("Hash Join");
  });

  test("traces inclusive runtime through a dominant child when estimates are sound", () => {
    const parent = node("1", 0, "Sort", { estimateRatio: 1, totalTime: 1_000, selfTime: 10 });
    const child = node("1.1", 1, "Seq Scan", { estimateRatio: 1, totalTime: 970, selfTime: 900 });
    const trace = rootCauseTrace([parent, child], parent);
    expect(trace?.kind).toBe("runtime");
    expect(trace?.origin.nodeType).toBe("Seq Scan");
  });

  test("withholds runtime causality when the selected node owns its time", () => {
    const scan = node("1", 0, "Seq Scan", { estimateRatio: 1, totalTime: 100, selfTime: 90 });
    expect(rootCauseTrace([scan], scan)).toBeNull();
  });
});
