import type { DatabaseContext } from "./database-context.ts";
import { findContextRelation } from "./database-context.ts";
import { indexCandidate, qualifyIndexCandidate, type IndexCandidate } from "./index-candidate.ts";
import type { PlanVisualNode } from "./types.ts";

export interface CandidateIndexExperiment {
  candidate: IndexCandidate;
  status: ReturnType<typeof qualifyIndexCandidate>["status"];
  confidence: "Low" | "Medium";
  candidateShape: string;
  overlap: string;
  unknowns: string[];
  risks: string[];
  prerequisites: string[];
  hypopg: { available: "unknown"; create: string; inspect: string; rollback: string };
  successCriteria: string[];
  rollback: string;
}

export function candidateIndexExperiment(node: PlanVisualNode, context: DatabaseContext | null): CandidateIndexExperiment | null {
  const candidate = indexCandidate(node);
  if (!candidate) return null;
  const qualification = qualifyIndexCandidate(candidate, context);
  const relation = findContextRelation(context, candidate.relation);
  const shape = `ON ${candidate.relation} (${candidate.columns.join(", ")})`;
  const blocked = ["existing-index", "overlap-review", "relation-missing", "column-mismatch"].includes(qualification.status);
  return {
    candidate,
    status: qualification.status,
    confidence: qualification.status === "qualified-candidate" ? "Medium" : "Low",
    candidateShape: shape,
    overlap: qualification.detail,
    unknowns: ["Predicate selectivity and parameter distribution", "Workload frequency and concurrency", "Existing expression/partial-index semantics", "Whether the planner will choose this shape"],
    risks: [`Every additional index adds write, vacuum, WAL, backup, and storage work${relation ? `; ${relation.indexes.length} index(es) are already captured on this relation` : ""}.`, relation?.totalSizeBytes ? `The relation currently occupies approximately ${(relation.totalSizeBytes / 1024 / 1024).toFixed(1)} MiB including indexes; candidate size is not known.` : "Candidate storage size is not established."],
    prerequisites: ["Use the same SQL and representative parameters.", "Confirm column types, operator classes, partial predicates, expression indexes, table size, and write rate.", blocked ? "Resolve the overlap or context blocker before testing a new shape." : "Use a non-production or approved session for the hypothetical experiment."],
    hypopg: {
      available: "unknown",
      create: `SELECT * FROM hypopg_create_index('CREATE INDEX ON ${candidate.relation} (${candidate.columns.join(", ")})');`,
      inspect: "Run EXPLAIN (without ANALYZE) for the same SQL and confirm whether PostgreSQL selects the hypothetical index. HypoPG estimates planning choices; it does not prove runtime improvement.",
      rollback: "SELECT hypopg_reset();",
    },
    successCriteria: ["The hypothetical plan selects the intended access path for representative parameters.", "A controlled physical test reduces shared reads and rows filtered at the scan.", "Repeated execution time improves without material write, WAL, storage, lock, or concurrency regression."],
    rollback: "Reset HypoPG after planning tests. If an approved physical test was performed, remove only that test index when success gates fail; do not alter existing indexes automatically.",
  };
}
