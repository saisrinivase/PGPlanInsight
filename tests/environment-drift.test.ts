import { describe, expect, test } from "vitest";
import { parseDatabaseContext, type DatabaseContext } from "../src/database-context.ts";
import { compareDatabaseEnvironments } from "../src/environment-drift.ts";

const context = (type = "bigint", setting = "4", extras: Partial<DatabaseContext> = {}) => parseDatabaseContext(JSON.stringify({
  version: 2,
  provenance: { collectedAt: "2026-09-02T12:00:00Z", postgresVersion: "16.4", collector: "manual", collectorVersion: "2", redacted: true },
  availability: Object.fromEntries(["relationStats", "columnStats", "indexStats", "extendedStats", "partitions", "settings"].map((name) => [name, { status: "captured" }])),
  settings: [{ name: "random_page_cost", value: setting }],
  relations: [{ schema: "public", name: "orders", kind: "table", modificationsSinceAnalyze: 100, columns: [{ name: "customer_id", type, nDistinct: 1000, statisticsTarget: 100 }], indexes: [{ name: "orders_customer_idx", columns: ["customer_id"], accessMethod: "btree", valid: true, ready: true }], extendedStatistics: [{ name: "orders_customer_status", columns: ["customer_id", "status"], kinds: ["dependencies"] }], partitions: [] }],
  ...extras,
}));

describe("environment drift comparison", () => {
  test("detects bigint to double precision drift and preserves the evidence boundary", () => {
    const report = compareDatabaseEnvironments(context("bigint"), context("double precision"));
    const drift = report.differences.find((item) => item.area === "column-type");
    expect(drift).toMatchObject({ severity: "critical", referenceValue: "bigint", targetValue: "double precision" });
    expect(drift?.hypothesis).toMatch(/implicit casts.*index eligibility|index eligibility.*implicit casts/i);
    expect(report.conclusion).toMatch(/do not prove the cause/i);
  });

  test("detects missing equivalent indexes, extended statistics, statistics state, and settings", () => {
    const reference = context();
    const target = context("bigint", "1.1", { relations: [{ ...reference.relations[0], modificationsSinceAnalyze: 20_000, indexes: [], extendedStatistics: [] }] });
    const areas = compareDatabaseEnvironments(reference, target).differences.map((item) => item.area);
    expect(areas).toEqual(expect.arrayContaining(["index", "extended-statistics", "statistics", "setting"]));
  });

  test("reports an exact captured-metadata match without claiming environment equivalence", () => {
    const report = compareDatabaseEnvironments(context(), context());
    expect(report.differences).toHaveLength(0);
    expect(report.conclusion).toMatch(/uncaptured workload and runtime conditions/i);
  });

  test("detects missing relations and invalid target indexes", () => {
    const reference = context();
    const missing = context("bigint", "4", { relations: [] });
    expect(compareDatabaseEnvironments(reference, missing).differences).toEqual(expect.arrayContaining([expect.objectContaining({ area: "relation", severity: "critical" })]));
    const invalid = context("bigint", "4", { relations: [{ ...reference.relations[0], indexes: [{ ...reference.relations[0].indexes[0], valid: false }] }] });
    expect(compareDatabaseEnvironments(reference, invalid).differences).toEqual(expect.arrayContaining([expect.objectContaining({ area: "index", severity: "critical" })]));
  });

  test("does not convert unavailable catalog coverage into a missing-object claim", () => {
    const reference = context();
    const target = context("bigint", "4", { availability: { ...reference.availability, indexStats: { status: "unavailable", reason: "Insufficient privilege" } }, relations: [{ ...reference.relations[0], indexes: [] }] });
    const indexDrift = compareDatabaseEnvironments(reference, target).differences.filter((item) => item.area === "index");
    expect(indexDrift).toHaveLength(1);
    expect(indexDrift[0]).toMatchObject({ severity: "info", object: "indexStats coverage", targetValue: "unavailable" });
    expect(indexDrift[0].observed).toMatch(/unavailable/i);
  });
});
