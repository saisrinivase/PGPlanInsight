import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { databaseContextExample, inspectDatabaseContext, parseDatabaseContext } from "../src/database-context.ts";
import { qualifyIndexCandidate } from "../src/index-candidate.ts";

const legacySource = JSON.stringify({ version: 1, relations: [{ schema: "public", name: "orders", columns: [{ name: "customer_id", type: "bigint" }], indexes: [{ name: "idx_orders_customer", columns: ["customer_id"], valid: true }] }] });
const pack = (postgresVersion = "16.4") => ({
  version: 2,
  provenance: { collectedAt: "2026-09-01T12:00:00.000Z", postgresVersion, collector: "pgplan-context-sql", collectorVersion: "2", redacted: true },
  availability: {
    relationStats: { status: "captured" }, columnStats: { status: "captured" }, indexStats: { status: "captured" },
    extendedStats: { status: "captured" }, partitions: { status: "captured" }, settings: { status: "captured" },
  },
  settings: [{ name: "default_statistics_target", value: "100" }],
  relations: [{
    schema: "public", name: "orders", kind: "partitioned-table", rowEstimate: 1_250_000, sizeBytes: 1000, totalSizeBytes: 2000,
    liveTuples: 1_200_000, deadTuples: 50_000, modificationsSinceAnalyze: 25_000, lastAutoAnalyze: "2026-08-31T12:00:00Z",
    columns: [{ name: "customer_id", type: "bigint", nullFraction: 0, nDistinct: 85000, correlation: 0.12, statisticsTarget: 250 }],
    indexes: [{ name: "idx_orders_customer", columns: ["customer_id"], includeColumns: ["created_at"], accessMethod: "btree", sizeBytes: 400, scans: 500, valid: true, ready: true }],
    extendedStatistics: [{ name: "orders_customer_status", columns: ["customer_id", "status"], kinds: ["dependencies", "mcv"] }],
    partitions: [{ schema: "public", name: "orders_2026", strategy: "range", keyColumns: ["created_at"] }],
  }],
});

describe("sanitized Database Context Pack", () => {
  test("normalizes legacy v1 without inventing unavailable evidence", () => {
    const result = inspectDatabaseContext(legacySource);
    expect(result.context.version).toBe(2);
    expect(result.context.provenance.collector).toBe("legacy-v1");
    expect(result.preview.sourceVersion).toBe(1);
    expect(result.preview.unavailableSections).toEqual(expect.arrayContaining(["extendedStats", "partitions", "settings"]));
  });

  test("accepts complete PostgreSQL 14–18 metadata and reports provenance and completeness", () => {
    for (const version of ["14.12", "16.4", "18.0"]) {
      const result = inspectDatabaseContext(JSON.stringify(pack(version)));
      expect(result.preview).toMatchObject({ relationCount: 1, columnCount: 1, indexCount: 1, extendedStatisticCount: 1, partitionCount: 1, settingsCount: 1 });
      expect(result.preview.warnings).not.toContain(expect.stringMatching(/outside the currently tested/i));
      expect(result.context.provenance.redacted).toBe(true);
    }
  });

  test("warns rather than fabricating support for an untested PostgreSQL version", () => {
    expect(inspectDatabaseContext(JSON.stringify(pack("13.15"))).preview.warnings.join(" ")).toMatch(/outside the currently tested 14–18/i);
  });

  test("previews and removes sensitive or unknown fields", () => {
    const source = { ...pack(), password: "must-not-survive", sqlText: "select secret", arbitrary: "ignored" };
    const result = inspectDatabaseContext(JSON.stringify(source));
    expect(result.preview.discardedFields).toEqual(expect.arrayContaining(["password", "sqlText", "arbitrary"]));
    expect(JSON.stringify(result.context)).not.toContain("must-not-survive");
    expect(JSON.stringify(result.context)).not.toContain("select secret");
  });

  test("rejects unredacted packs, unsafe settings, malformed input, and oversize input", () => {
    expect(() => parseDatabaseContext("{}")).toThrow(/version 1 or 2/i);
    expect(() => parseDatabaseContext(JSON.stringify({ ...pack(), provenance: { ...pack().provenance, redacted: false } }))).toThrow(/redacted must be true/i);
    expect(() => parseDatabaseContext(JSON.stringify({ ...pack(), settings: [{ name: "shared_preload_libraries", value: "x" }] }))).toThrow(/safe planner-setting allowlist/i);
    expect(() => parseDatabaseContext(" ".repeat(1_000_001))).toThrow(/1 MB safety limit/i);
  });

  test("the shipped example parses and imported indexes prevent duplicate advice", () => {
    expect(parseDatabaseContext(databaseContextExample).version).toBe(2);
    const context = parseDatabaseContext(legacySource);
    const result = qualifyIndexCandidate({ sql: "CREATE INDEX CONCURRENTLY ON public.orders (customer_id);", relation: "public.orders", columns: ["customer_id"], qualification: "plan only", predicateEvidence: "customer_id = 42", keyRationale: "equality first" }, context);
    expect(result.status).toBe("overlap-review");
    expect(result.detail).toContain("idx_orders_customer");
  });

  test("collector SQL is read-only and excludes sensitive catalog surfaces", () => {
    const sql = readFileSync(new URL("../public/pgplan-context-pack.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/BEGIN TRANSACTION READ ONLY/i);
    expect(sql).toContain("pg_statistic_ext");
    expect(sql).toContain("pg_partitioned_table");
    expect(sql).not.toMatch(/pg_stat_activity|rolpassword|query_text|most_common_vals|histogram_bounds/i);
  });
});
