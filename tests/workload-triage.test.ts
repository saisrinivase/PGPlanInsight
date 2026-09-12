import { describe, expect, it } from "vitest";
import { parseWorkloadSnapshot, rankWorkload, type WorkloadSnapshot } from "../src/workload-triage.ts";

const snapshot: WorkloadSnapshot = { version: 1, provenance: { collectedAt: "2026-09-12T10:00:00Z", postgresVersion: "16.4", collector: "pgplan-workload-sql", redacted: true }, statements: [
  { fingerprint: "query-reads", calls: 20, totalExecTimeMs: 20_000, meanExecTimeMs: 1_000, rows: 100, sharedHitBlocks: 20, sharedReadBlocks: 900, tempReadBlocks: 0, tempWrittenBlocks: 0, walBytes: 0 },
  { fingerprint: "query-frequent", calls: 10_000, totalExecTimeMs: 40_000, meanExecTimeMs: 4, rows: 10_000, sharedHitBlocks: 100_000, sharedReadBlocks: 10, tempReadBlocks: 0, tempWrittenBlocks: 0, walBytes: 0 },
  { fingerprint: "query-spill", calls: 10, totalExecTimeMs: 60_000, meanExecTimeMs: 6_000, rows: 10, sharedHitBlocks: 100, sharedReadBlocks: 5, tempReadBlocks: 800, tempWrittenBlocks: 900, walBytes: 0 },
] };

describe("workload triage", () => {
  it("ranks by captured total database time and retains an auditable share", () => {
    const ranked = rankWorkload(snapshot);
    expect(ranked.map((row) => row.fingerprint)).toEqual(["query-spill", "query-frequent", "query-reads"]);
    expect(ranked[0]).toMatchObject({ rank: 1, databaseTimeShare: 50, focus: "Temporary I/O" });
    expect(ranked[1].focus).toBe("Frequency");
    expect(ranked[2].focus).toBe("Physical reads");
  });

  it("accepts the sanitized collector contract", () => expect(parseWorkloadSnapshot(JSON.stringify(snapshot))).toEqual(snapshot));

  it.each([
    [{ ...snapshot, version: 2 }, "version must be 1"],
    [{ ...snapshot, provenance: { ...snapshot.provenance, redacted: false } }, "Only redacted"],
    [{ ...snapshot, statements: [{ ...snapshot.statements[0], query: "select secret" }] }, "SQL text"],
    [{ ...snapshot, statements: [snapshot.statements[0], snapshot.statements[0]] }, "duplicate fingerprints"],
    [{ ...snapshot, statements: [{ ...snapshot.statements[0], calls: -1 }] }, "non-negative"],
  ])("rejects unsafe or invalid evidence: %#", (value, message) => expect(() => parseWorkloadSnapshot(JSON.stringify(value))).toThrow(message));

  it("does not invent an impact share when no execution time was recorded", () => {
    const zero = { ...snapshot, statements: [{ ...snapshot.statements[0], totalExecTimeMs: 0 }] };
    expect(rankWorkload(zero)[0].databaseTimeShare).toBe(0);
  });

  it("accepts and ranks the maximum supported statement count", () => {
    const large = { ...snapshot, statements: Array.from({ length: 5_000 }, (_, index) => ({ ...snapshot.statements[0], fingerprint: `query-${index}`, totalExecTimeMs: index })) };
    const parsed = parseWorkloadSnapshot(JSON.stringify(large));
    expect(rankWorkload(parsed)).toHaveLength(5_000);
    expect(rankWorkload(parsed)[0].fingerprint).toBe("query-4999");
  });

  it("rejects snapshots above the statement ceiling", () => {
    const tooMany = { ...snapshot, statements: Array.from({ length: 5_001 }, (_, index) => ({ ...snapshot.statements[0], fingerprint: `query-${index}` })) };
    expect(() => parseWorkloadSnapshot(JSON.stringify(tooMany))).toThrow("5,000 statement limit");
  });

  it("rejects snapshots above the byte ceiling before parsing", () => expect(() => parseWorkloadSnapshot(` ${"x".repeat(2_000_000)}`)).toThrow("2 MB limit"));

  it("rejects invalid collection timestamps", () => {
    const invalid = { ...snapshot, provenance: { ...snapshot.provenance, collectedAt: "not-a-date" } };
    expect(() => parseWorkloadSnapshot(JSON.stringify(invalid))).toThrow("ISO timestamp");
  });
});
