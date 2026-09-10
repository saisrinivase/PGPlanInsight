import { describe, expect, test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";
import { evidenceClaims } from "../src/evidence-assessment.ts";

const analyzed = (plan: Record<string, unknown>) => analyzePlan(JSON.stringify([plan]));

describe("canonical evidence classifications", () => {
  test("returns every classification in a stable order", () => {
    const result = analyzed({ Plan: { "Node Type": "Seq Scan", "Plan Rows": 100 }, "Planning Time": 1 });
    const claims = evidenceClaims(result, result.findings[0]);

    expect(claims.map((claim) => claim.classification)).toEqual(["observed", "derived", "suspected", "unknown", "verified"]);
    expect(claims.find((claim) => claim.classification === "verified")).toMatchObject({ status: "not-established" });
  });

  test("keeps absent runtime and catalog context unknown instead of inventing causality", () => {
    const result = analyzed({ Plan: { "Node Type": "Seq Scan", "Plan Rows": 100 }, "Planning Time": 1 });
    const claims = evidenceClaims(result, result.findings[0]);
    const unknown = claims.find((claim) => claim.classification === "unknown");

    expect(result.findings[0].id).toBe("EV-001");
    expect(unknown?.detail).toContain("Runtime: Estimated-only capture");
    expect(unknown?.detail).toContain("statistics freshness");
    expect(unknown?.detail).not.toMatch(/statistics (are|were) stale/i);
  });

  test("labels a visible cast as observed while leaving its origin and impact unverified", () => {
    const result = analyzed({ Plan: { "Node Type": "Index Scan", "Actual Total Time": 10, "Actual Rows": 1, "Actual Loops": 1, "Plan Rows": 1, "Index Cond": "((id)::double precision = 42)" }, "Execution Time": 10 });
    const finding = result.findings.find((item) => item.id === "TYPE-001");
    expect(finding).toBeDefined();

    const claims = evidenceClaims(result, finding!);
    expect(claims.find((claim) => claim.classification === "observed")?.detail).toContain("double precision");
    expect(claims.find((claim) => claim.classification === "suspected")?.detail).toContain("may have introduced");
    expect(claims.find((claim) => claim.classification === "verified")?.status).toBe("not-established");
  });
});
