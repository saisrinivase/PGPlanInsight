import { describe, expect, test } from "vitest";
import { nodeSignal } from "../src/node-signal.ts";
import type { PlanVisualNode } from "../src/types.ts";

const node = (changes: Partial<PlanVisualNode> = {}): PlanVisualNode => ({ rank: 1, nodeType: "Index Scan", relation: "orders", totalTime: 20, rows: 1, plannedRows: 1, loops: 1, estimateRatio: 1, tempBlocks: 0, sharedReads: 0, depth: 0, path: "1", selfTime: 20, timeShare: 10, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "", tempReadBlocks: 0, tempWrittenBlocks: 0, tempReadTime: 0, tempWriteTime: 0, spillRole: null, spillMethod: "", ...changes });

describe("plan-node signal language", () => {
  test("does not label missing runtime evidence as healthy", () => expect(nodeSignal(node({ loops: 0, totalTime: 0 })).level).toBe("unknown"));
  test("marks only the direct spill operation as critical", () => {
    const signal = nodeSignal(node({ nodeType: "Sort", tempBlocks: 48, tempReadBlocks: 24, tempWrittenBlocks: 24, spillRole: "direct", spillMethod: "external merge" }));
    expect(signal.level).toBe("critical"); expect(signal.label).toBe("Spill source");
  });
  test("labels ancestor temp counters as inherited evidence", () => {
    const signal = nodeSignal(node({ tempBlocks: 48, tempReadBlocks: 24, tempWrittenBlocks: 24, spillRole: "inherited" }));
    expect(signal.level).toBe("review"); expect(signal.label).toBe("Inherited temp I/O"); expect(signal.reason).toMatch(/inclusive descendant/i);
  });
  test("describes estimate mismatch as a verification task, not proven stale statistics", () => {
    const signal = nodeSignal(node({ estimateRatio: 24 }));
    expect(signal.level).toBe("review"); expect(signal.reason).toMatch(/verify statistics, selectivity, and correlation/i);
  });
  test("marks nodes without crossed thresholds as healthy", () => expect(nodeSignal(node()).level).toBe("healthy"));
  test("does not call inherited Sort estimate drift a runtime bottleneck", () => {
    const signal = nodeSignal(node({ nodeType: "Sort", estimateRatio: 1545, totalTime: 3673, selfTime: 1.7 }));
    expect(signal.label).toBe("Estimate issue");
    expect(signal.reason).toMatch(/inherits rows|trace the first child/i);
    expect(signal.reason).not.toMatch(/verify statistics and data skew$/i);
  });
  test("keeps row-producing estimate guidance conditional", () => {
    const signal = nodeSignal(node({ nodeType: "Seq Scan", estimateRatio: 1545 }));
    expect(signal.label).toBe("Estimate issue");
    expect(signal.reason).toMatch(/verify statistics, selectivity, correlation, and data skew/i);
  });
});
