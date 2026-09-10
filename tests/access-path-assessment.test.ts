import { describe, expect, test } from "vitest";
import { accessPathAssessment } from "../src/access-path-assessment.ts";
import type { PlanVisualNode } from "../src/types.ts";

const node = (values: Partial<PlanVisualNode>): PlanVisualNode => ({ rank: 1, depth: 0, path: "1", nodeType: "Seq Scan", relation: "orders", totalTime: 10, selfTime: 10, timeShare: 5, rows: 10, plannedRows: 10, loops: 1, estimateRatio: 1, tempBlocks: 0, sharedReads: 0, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "", ...values });

describe("access path interpretation", () => {
  test("does not call an ordinary sequential scan bad", () => expect(accessPathAssessment(node({})).level).toBe("info"));
  test("reviews a sequential scan only with measured material filtering evidence", () => expect(accessPathAssessment(node({ predicate: "customer_id = 42", sharedReads: 5_000 })).level).toBe("review"));
  test("prioritizes estimate evidence for a sequential scan", () => expect(accessPathAssessment(node({ estimateRatio: 120 })).reason).toContain("120.0×"));
  test("treats a non-amplified index scan as good", () => expect(accessPathAssessment(node({ nodeType: "Index Scan", predicate: "customer_id = 42" })).level).toBe("good"));
  test("does not call an index scan good when probes are amplified", () => expect(accessPathAssessment(node({ nodeType: "Index Scan", loops: 2_000 })).level).toBe("review"));
  test("requires bitmap heap evidence to be interpreted with rechecks", () => expect(accessPathAssessment(node({ nodeType: "Bitmap Heap Scan" })).nextAction).toContain("Lossy"));
});
