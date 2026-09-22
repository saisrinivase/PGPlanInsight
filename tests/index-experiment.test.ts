import { describe, expect, test } from "vitest";
import { candidateIndexExperiment } from "../src/index-experiment.ts";
import { indexCandidate } from "../src/index-candidate.ts";
import type { DatabaseContext } from "../src/database-context.ts";
import type { PlanVisualNode } from "../src/types.ts";

const scan = (changes: Partial<PlanVisualNode> = {}): PlanVisualNode => ({ rank: 1, depth: 0, path: "1", nodeType: "Seq Scan", relation: "public.orders", totalTime: 500, selfTime: 500, timeShare: 80, rows: 10, plannedRows: 10, loops: 1, estimateRatio: 1, tempBlocks: 0, sharedReads: 5_000, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "created_at >= '2026-01-01' AND customer_id = 42", tempReadBlocks: 0, tempWrittenBlocks: 0, tempReadTime: 0, tempWriteTime: 0, spillRole: null, spillMethod: "", ...changes });
const context = (indexes: DatabaseContext["relations"][number]["indexes"] = []): DatabaseContext => ({ version: 2, provenance: { collectedAt: "2026-09-01T00:00:00Z", postgresVersion: "18.3", collector: "pgplan-context-sql", collectorVersion: "2", redacted: true }, availability: { relationStats: { status: "captured" }, columnStats: { status: "captured" }, indexStats: { status: "captured" }, extendedStats: { status: "captured" }, partitions: { status: "captured" }, settings: { status: "captured" } }, settings: [], relations: [{ schema: "public", name: "orders", liveTuples: 1_000_000, totalSizeBytes: 512 * 1024 * 1024, columns: [{ name: "customer_id", type: "bigint" }, { name: "created_at", type: "timestamp" }], indexes }] });

describe("controlled candidate-index experiments", () => {
  test("orders equality keys before range keys and retains predicate evidence", () => {
    const candidate = indexCandidate(scan())!;
    expect(candidate.columns).toEqual(["customer_id", "created_at"]);
    expect(candidate.predicateEvidence).toContain("created_at");
    expect(candidate.keyRationale).toMatch(/Equality keys first.*customer_id/i);
  });
  test("does not derive a compound candidate from OR or expression predicates", () => {
    expect(indexCandidate(scan({ predicate: "customer_id = 42 OR status = 'OPEN'" }))).toBeNull();
    expect(indexCandidate(scan({ predicate: "abs(customer_id) = 42" }))).toBeNull();
  });
  test("keeps plan-only candidates low confidence and non-executable in the primary shape", () => {
    const result = candidateIndexExperiment(scan(), null)!;
    expect(result).toMatchObject({ status: "context-missing", confidence: "Low", candidateShape: "ON public.orders (customer_id, created_at)" });
    expect(result.candidateShape).not.toMatch(/^\s*(CREATE|DROP)\b/i);
    expect(result.testSql).toBeNull();
    expect(result.unknowns).toContain("Workload frequency and concurrency");
  });
  test("blocks duplicate and overlapping shapes", () => {
    expect(candidateIndexExperiment(scan(), context([{ name: "orders_customer_created", columns: ["customer_id", "created_at"], valid: true, ready: true, accessMethod: "btree", hasPredicate: false, hasExpressions: false }]))).toMatchObject({ status: "existing-index", confidence: "Low" });
    expect(candidateIndexExperiment(scan(), context([{ name: "orders_customer_status", columns: ["customer_id", "status"], valid: true }]))).toMatchObject({ status: "overlap-review", confidence: "Low" });
  });
  test.each(["customer_id::numeric = 42", "customer_id = 42 AND abs(created_at) = 0", "customer_id != 42", "customer_id = other_id", "customer_id() = 42", "customer_id = 42 /* ignored */"])("abstains for unsupported predicate %s", (predicate) => {
    expect(indexCandidate(scan({ predicate }))).toBeNull();
  });
  test("does not parse operators inside string literals", () => {
    expect(indexCandidate(scan({ predicate: "customer_id = 'x OR fake = 3'" }))?.columns).toEqual(["customer_id"]);
    expect(indexCandidate(scan({ predicate: "((customer_id = 42) AND (created_at > 0))" }))?.columns).toEqual(["customer_id", "created_at"]);
  });
  test.each([{ hasPredicate: true }, { hasExpressions: true }, { valid: false }, { ready: false }, { accessMethod: "hash" }, { ready: undefined }])("does not claim coverage with incompatible or missing metadata %j", (override) => {
    const index = { name: "idx", columns: ["customer_id", "created_at"], valid: true, ready: true, accessMethod: "btree", hasPredicate: false, hasExpressions: false, ...override };
    expect(candidateIndexExperiment(scan(), context([index]))?.status).toBe("overlap-review");
  });
  test("unavailable inventory is not evidence of missing indexes", () => {
    const pack = context();
    pack.availability.indexStats.status = "unavailable";
    expect(candidateIndexExperiment(scan(), pack)?.status).toBe("context-incomplete");
  });
  test("qualifies a context-checked shape and supplies reversible HypoPG gates", () => {
    const result = candidateIndexExperiment(scan(), context())!;
    expect(result).toMatchObject({ status: "qualified-candidate", confidence: "Medium" });
    expect(result.testSql).toBe("CREATE INDEX ON public.orders USING btree (customer_id, created_at);");
    expect(result.hypopg.create).toContain("hypopg_create_index");
    expect(result.hypopg.inspect).toMatch(/without ANALYZE.*does not prove runtime/i);
    expect(result.hypopg.rollback).toBe("SELECT hypopg_reset();");
    expect(result.successCriteria.join(" ")).toMatch(/shared reads.*write.*WAL.*concurrency/i);
  });
  test("withholds physical SQL for duplicate, overlap, and incomplete context", () => {
    for (const indexes of [[{ name: "idx", columns: ["customer_id", "created_at"], valid: true, ready: true, accessMethod: "btree", hasPredicate: false, hasExpressions: false }], [{ name: "idx", columns: ["customer_id"] }]]) {
      expect(candidateIndexExperiment(scan(), context(indexes))?.testSql).toBeNull();
    }
    const pack = context();
    pack.availability.indexStats.status = "unavailable";
    expect(candidateIndexExperiment(scan(), pack)?.testSql).toBeNull();
    expect(candidateIndexExperiment(scan({ relation: "orders" }), context())?.testSql).toBeNull();
  });
});
