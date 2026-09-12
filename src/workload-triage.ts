const MAX_BYTES = 2_000_000;
const MAX_STATEMENTS = 5_000;

export interface WorkloadStatement {
  fingerprint: string;
  calls: number;
  totalExecTimeMs: number;
  meanExecTimeMs: number;
  rows: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  tempReadBlocks: number;
  tempWrittenBlocks: number;
  walBytes: number;
}

export interface WorkloadSnapshot {
  version: 1;
  provenance: {
    collectedAt: string;
    postgresVersion: string;
    statsResetAt?: string;
    collector: "pgplan-workload-sql";
    redacted: true;
  };
  statements: WorkloadStatement[];
}

export type WorkloadFocus = "Database time" | "Latency" | "Frequency" | "Physical reads" | "Temporary I/O" | "WAL";

export interface RankedWorkloadStatement extends WorkloadStatement {
  rank: number;
  databaseTimeShare: number;
  focus: WorkloadFocus;
  focusEvidence: string;
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string, max = 100): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} must be a non-empty string no longer than ${max} characters.`);
  return value.trim();
};
const number = (value: unknown, label: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite, non-negative number.`);
  return value;
};
const exactKeys = (value: Record<string, unknown>, allowed: string[], label: string) => {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error(`${label} contains unsupported field: ${extra[0]}. SQL text and unrecognized fields are not accepted.`);
};

export function parseWorkloadSnapshot(source: string): WorkloadSnapshot {
  if (new TextEncoder().encode(source).byteLength > MAX_BYTES) throw new Error("Workload snapshot exceeds the 2 MB limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("Workload snapshot is not valid JSON."); }
  const root = object(parsed, "Workload snapshot");
  exactKeys(root, ["version", "provenance", "statements"], "Workload snapshot");
  if (root.version !== 1) throw new Error("Workload snapshot version must be 1.");
  const provenance = object(root.provenance, "Provenance");
  exactKeys(provenance, ["collectedAt", "postgresVersion", "statsResetAt", "collector", "redacted"], "Provenance");
  const collectedAt = text(provenance.collectedAt, "Collection time", 50);
  if (!Number.isFinite(Date.parse(collectedAt))) throw new Error("Collection time must be an ISO timestamp.");
  if (provenance.collector !== "pgplan-workload-sql" || provenance.redacted !== true) throw new Error("Only redacted PGPlan workload snapshots are accepted.");
  if (!Array.isArray(root.statements)) throw new Error("Statements must be an array.");
  if (!root.statements.length) throw new Error("Workload snapshot contains no statements.");
  if (root.statements.length > MAX_STATEMENTS) throw new Error(`Workload snapshot exceeds the ${MAX_STATEMENTS.toLocaleString()} statement limit.`);
  const statements = root.statements.map((raw, index) => {
    const row = object(raw, `Statement ${index + 1}`);
    const keys = ["fingerprint", "calls", "totalExecTimeMs", "meanExecTimeMs", "rows", "sharedHitBlocks", "sharedReadBlocks", "tempReadBlocks", "tempWrittenBlocks", "walBytes"];
    exactKeys(row, keys, `Statement ${index + 1}`);
    return {
      fingerprint: text(row.fingerprint, `Statement ${index + 1} fingerprint`, 80),
      calls: number(row.calls, `Statement ${index + 1} calls`),
      totalExecTimeMs: number(row.totalExecTimeMs, `Statement ${index + 1} total execution time`),
      meanExecTimeMs: number(row.meanExecTimeMs, `Statement ${index + 1} mean execution time`),
      rows: number(row.rows, `Statement ${index + 1} rows`),
      sharedHitBlocks: number(row.sharedHitBlocks, `Statement ${index + 1} shared hits`),
      sharedReadBlocks: number(row.sharedReadBlocks, `Statement ${index + 1} shared reads`),
      tempReadBlocks: number(row.tempReadBlocks, `Statement ${index + 1} temp reads`),
      tempWrittenBlocks: number(row.tempWrittenBlocks, `Statement ${index + 1} temp writes`),
      walBytes: number(row.walBytes, `Statement ${index + 1} WAL bytes`),
    };
  });
  if (new Set(statements.map((row) => row.fingerprint)).size !== statements.length) throw new Error("Workload snapshot contains duplicate fingerprints.");
  return { version: 1, provenance: { collectedAt, postgresVersion: text(provenance.postgresVersion, "PostgreSQL version", 80), ...(provenance.statsResetAt == null ? {} : { statsResetAt: text(provenance.statsResetAt, "Statistics reset time", 50) }), collector: "pgplan-workload-sql", redacted: true }, statements };
}

function focusFor(row: WorkloadStatement, maxCalls: number): Pick<RankedWorkloadStatement, "focus" | "focusEvidence"> {
  const temp = row.tempReadBlocks + row.tempWrittenBlocks;
  if (temp > 0) return { focus: "Temporary I/O", focusEvidence: `${temp.toLocaleString()} temporary blocks were captured.` };
  if (row.sharedReadBlocks > row.sharedHitBlocks && row.sharedReadBlocks > 0) return { focus: "Physical reads", focusEvidence: `${row.sharedReadBlocks.toLocaleString()} shared blocks were read.` };
  if (row.walBytes >= 10_000_000) return { focus: "WAL", focusEvidence: `${formatBytes(row.walBytes)} of WAL was attributed to this fingerprint.` };
  if (row.meanExecTimeMs >= 1_000) return { focus: "Latency", focusEvidence: `${formatDuration(row.meanExecTimeMs)} mean execution time per call.` };
  if (maxCalls > 0 && row.calls >= maxCalls * .5) return { focus: "Frequency", focusEvidence: `${row.calls.toLocaleString()} calls accumulated database time.` };
  return { focus: "Database time", focusEvidence: `${formatDuration(row.totalExecTimeMs)} total execution time was captured.` };
}

export function rankWorkload(snapshot: WorkloadSnapshot): RankedWorkloadStatement[] {
  const total = snapshot.statements.reduce((sum, row) => sum + row.totalExecTimeMs, 0);
  const maxCalls = Math.max(...snapshot.statements.map((row) => row.calls));
  return [...snapshot.statements].sort((a, b) => b.totalExecTimeMs - a.totalExecTimeMs || b.sharedReadBlocks - a.sharedReadBlocks || a.fingerprint.localeCompare(b.fingerprint)).map((row, index) => ({ ...row, rank: index + 1, databaseTimeShare: total ? row.totalExecTimeMs / total * 100 : 0, ...focusFor(row, maxCalls) }));
}

export const formatDuration = (milliseconds: number) => milliseconds >= 60_000 ? `${(milliseconds / 60_000).toFixed(1)} min` : milliseconds >= 1_000 ? `${(milliseconds / 1_000).toFixed(2)} s` : `${milliseconds.toFixed(1)} ms`;
export const formatBytes = (bytes: number) => bytes >= 1_073_741_824 ? `${(bytes / 1_073_741_824).toFixed(1)} GB` : bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes >= 1_024 ? `${(bytes / 1_024).toFixed(1)} kB` : `${bytes.toFixed(0)} B`;
