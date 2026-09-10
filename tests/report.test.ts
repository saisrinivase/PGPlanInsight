import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";
import { buildAnalysisReport } from "../src/report.ts";

describe("DBA triage export", () => {
  test("prioritizes investigation and an indented plan instead of a dotted-path dump", () => {
    const source = readFileSync(new URL("./enterprise_plans/06_external_sort_spill.json", import.meta.url), "utf8");
    const report = buildAnalysisReport(analyzePlan(source));
    expect(report).toContain("## Investigation order");
    expect(report).toContain("## Highest exclusive-work operations");
    expect(report).toContain("## Complete execution tree");
    expect(report).toContain("Exclusive/self time is prioritized");
    expect(report).not.toContain("| Path | Node | Relation |");
  });

  test("exports proven casts with an explicit evidence boundary", () => {
    const source = JSON.stringify([{ Plan: { "Node Type": "Hash Join", "Actual Total Time": 10, "Actual Rows": 1, "Actual Loops": 1, "Plan Rows": 1, "Hash Cond": "((mv.id)::double precision = source.id)" }, "Execution Time": 10 }]);
    const report = buildAnalysisReport(analyzePlan(source));
    expect(report).toContain("## Type-coercion evidence");
    expect(report).toContain("double precision");
    expect(report).toContain("material runtime impact and its origin are not");
    expect(report).toContain("OBSERVED · Captured fact");
    expect(report).toContain("DERIVED · Rule result");
    expect(report).toContain("SUSPECTED · Cause to test");
    expect(report).toContain("UNKNOWN · Not established");
    expect(report).toContain("VERIFIED · After-plan proof (not established)");
  });
});
