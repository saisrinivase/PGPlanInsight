import { describe, expect, test } from "vitest";
import { typeCoercionDiagnosis } from "../src/type-coercion-diagnosis.ts";
import type { DatabaseContext } from "../src/database-context.ts";
import type { PlanVisualNode } from "../src/types.ts";

const node = (changes: Partial<PlanVisualNode> = {}): PlanVisualNode => ({ rank: 1, depth: 0, path: "1", nodeType: "Hash Join", relation: "—", totalTime: 100, selfTime: 10, timeShare: 50, rows: 10, plannedRows: 10, loops: 1, estimateRatio: 1, tempBlocks: 0, sharedReads: 0, flags: [], workersPlanned: 0, workersLaunched: 0, predicate: "", tempReadBlocks: 0, tempWrittenBlocks: 0, tempReadTime: 0, tempWriteTime: 0, spillRole: null, spillMethod: "", expressions: [], ...changes });
const context: DatabaseContext = { version: 2, provenance: { collectedAt: "2026-09-01T00:00:00Z", postgresVersion: "18.3", collector: "pgplan-context-sql", collectorVersion: "2", redacted: true }, availability: { relationStats: { status: "captured" }, columnStats: { status: "captured" }, indexStats: { status: "captured" }, extendedStats: { status: "captured" }, partitions: { status: "captured" }, settings: { status: "captured" } }, settings: [], relations: [{ schema: "public", name: "prod_mv", kind: "materialized-view", columns: [{ name: "application_id", type: "bigint" }], indexes: [] }] };

describe("type coercion diagnosis", () => {
  test("keeps predicate impact and origin unverified", () => {
    const result = typeCoercionDiagnosis([node({ expressions: [{ source: "Hash Cond", text: "((prod_mv.application_id)::double precision = source.application_id)" }] })], null);
    expect(result).toMatchObject({ signal: "predicate-coercion", classification: "observed" });
    expect(result.evidence).toContain("prod_mv.application_id");
    expect(result.unknown).toMatch(/does not prove.*prevented index use/i);
  });
  test("identifies output coercion below Append as a UNION branch hypothesis", () => {
    const append = node({ nodeType: "Append", path: "1", depth: 0, expressions: [] });
    const branch = node({ nodeType: "Seq Scan", relation: "public.a", path: "1.1", depth: 1, expressions: [{ source: "Output", text: "(application_id)::double precision" }] });
    expect(typeCoercionDiagnosis([append, branch], null)).toMatchObject({ signal: "set-operation-output", classification: "suspected" });
  });
  test("qualifies a materialized-view boundary only with imported context", () => {
    const scan = node({ nodeType: "Seq Scan", relation: "public.prod_mv", expressions: [{ source: "Output", text: "(application_id)::double precision" }] });
    expect(typeCoercionDiagnosis([scan], context)).toMatchObject({ signal: "materialized-view-output", classification: "suspected" });
    expect(typeCoercionDiagnosis([scan], null)).toMatchObject({ signal: "output-coercion", classification: "observed" });
  });
  test("does not invent coercion from typed constants or absent fields", () => {
    expect(typeCoercionDiagnosis([node({ expressions: [{ source: "Filter", text: "status = '1'::integer" }] })], null)).toMatchObject({ signal: "none" });
  });
});
