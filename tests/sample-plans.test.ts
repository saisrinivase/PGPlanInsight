import { describe, expect, it } from "vitest";
import { buildScaleSample, SAMPLE_PLANS } from "../src/sample-plans.ts";

function countNodes(node: Record<string, unknown>): number {
  const children = Array.isArray(node.Plans) ? node.Plans as Record<string, unknown>[] : [];
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}

describe("sample plan catalog", () => {
  it("exposes diagnostic and explicitly synthetic scale examples", () => {
    expect(SAMPLE_PLANS.filter((sample) => sample.category === "diagnostic")).toHaveLength(6);
    expect(SAMPLE_PLANS.filter((sample) => sample.category === "scale").map((sample) => sample.nodeCount)).toEqual([100, 500, 1_000, 2_000]);
  });

  it.each([100, 500, 1_000, 2_000])("builds a valid %i-node bounded plan", (nodeCount) => {
    const parsed = JSON.parse(buildScaleSample(nodeCount));
    expect(countNodes(parsed[0].Plan)).toBe(nodeCount);
    expect(parsed[0]["Execution Time"]).toBeGreaterThan(0);
  });

  it("rejects scale samples outside the supported node boundary", () => {
    expect(() => buildScaleSample(2_001)).toThrow(/2,000/);
  });
});
