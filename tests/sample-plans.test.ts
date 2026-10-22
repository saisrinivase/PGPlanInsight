import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildScaleSample, SAMPLE_PLANS } from "../src/sample-plans.ts";

function countNodes(node: Record<string, unknown>): number {
  const children = Array.isArray(node.Plans) ? node.Plans as Record<string, unknown>[] : [];
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}

describe("sample plan catalog", () => {
  it.each(SAMPLE_PLANS.filter((sample) => sample.path))("$title has a complete executable tree shape", (sample) => {
    const [capture] = JSON.parse(readFileSync(new URL(`../public${sample.path}`, import.meta.url), "utf8"));
    const visit = (node: Record<string, any>) => {
      const children = node.Plans ?? [];
      const regular = children.filter((child: Record<string, any>) => !["SubPlan", "InitPlan"].includes(child["Parent Relationship"]));
      if (["Nested Loop", "Hash Join", "Merge Join"].includes(node["Node Type"])) {
        expect(regular.map((child: Record<string, any>) => child["Parent Relationship"])).toEqual(["Outer", "Inner"]);
        if (node["Node Type"] === "Nested Loop") {
          expect(regular[1]["Actual Loops"]).toBe(regular[0]["Actual Rows"] * regular[0]["Actual Loops"]);
        }
      }
      if (["Sort", "Hash", "Gather", "ModifyTable"].includes(node["Node Type"])) expect(regular).toHaveLength(1);
      if (node["Workers Planned"] !== undefined) expect(["Gather", "Gather Merge"]).toContain(node["Node Type"]);
      for (const child of regular) {
        expect(child["Actual Total Time"] * child["Actual Loops"]).toBeLessThanOrEqual(node["Actual Total Time"] * node["Actual Loops"]);
      }
      children.forEach(visit);
    };
    visit(capture.Plan);
    expect(capture["Execution Time"]).toBeGreaterThanOrEqual(capture.Plan["Actual Total Time"]);
  });
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
