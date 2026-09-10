import type { PlanVisualNode } from "./types.ts";
import type { DatabaseContext } from "./database-context.ts";
import { findContextRelation } from "./database-context.ts";

export interface IndexCandidate {
  sql: string;
  qualification: string;
  relation: string;
  columns: string[];
  predicateEvidence: string;
  keyRationale: string;
}

function predicateTerms(predicate: string) {
  const columns = new Map<string, string>();
  const pattern = /((?:[a-z_][\w$]*\.)?[a-z_][\w$]*)\s*(=|<>|!=|<=|>=|<|>|\bIS\b|\bIN\b|\bLIKE\b)/gi;
  for (const match of predicate.matchAll(pattern)) {
    const column = match[1].split(".").at(-1)?.replace(/[^a-zA-Z0-9_$]/g, "");
    if (column && !["and", "or", "not", "null"].includes(column.toLowerCase())) columns.set(column, match[2].toUpperCase());
  }
  return [...columns].map(([column, operator]) => ({ column, operator })).sort((a, b) => Number(b.operator === "=") - Number(a.operator === "=")).slice(0, 3);
}

export function indexCandidate(node: PlanVisualNode | null): IndexCandidate | null {
  if (!node || !/seq scan/i.test(node.nodeType) || node.relation === "—" || !node.predicate) return null;
  if (!/^[a-z_][\w$]*(\.[a-z_][\w$]*)?$/i.test(node.relation)) return null;
  if (/\bOR\b/i.test(node.predicate)) return null;
  const terms = predicateTerms(node.predicate);
  const columns = terms.map((term) => term.column);
  if (!columns.length) return null;
  return {
    sql: `ON ${node.relation} (${columns.join(", ")})`,
    qualification: "Candidate shape from the pasted plan only — no PostgreSQL catalog was checked. Confirm existing indexes, selectivity, statistics, write cost, column order, data distribution, and production workload before testing it.",
    relation: node.relation,
    columns,
    predicateEvidence: node.predicate,
    keyRationale: `Equality keys first (${terms.filter((term) => term.operator === "=").map((term) => term.column).join(", ") || "none captured"}); range/other keys follow (${terms.filter((term) => term.operator !== "=").map((term) => `${term.column} ${term.operator}`).join(", ") || "none captured"}).`,
  };
}

export function qualifyIndexCandidate(candidate: IndexCandidate, context: DatabaseContext | null) {
  const relation = findContextRelation(context, candidate.relation);
  if (!context) return { status: "context-missing" as const, detail: candidate.qualification };
  if (!relation) return { status: "relation-missing" as const, detail: `The imported context does not contain ${candidate.relation}; catalog qualification remains incomplete.` };
  const missingColumns = candidate.columns.filter((column) => !relation.columns.some((item) => item.name.toLowerCase() === column.toLowerCase()));
  if (missingColumns.length) return { status: "column-mismatch" as const, detail: `Context does not contain candidate column(s): ${missingColumns.join(", ")}. Verify plan aliases and schema before testing DDL.` };
  const covering = relation.indexes.find((index) => index.valid !== false && candidate.columns.every((column, position) => index.columns[position]?.toLowerCase() === column.toLowerCase()));
  if (covering) return { status: "existing-index" as const, detail: `${covering.name} already begins with (${candidate.columns.join(", ")}). Investigate usability, predicate/type compatibility, statistics, and planner choice instead of creating a duplicate.` };
  const overlapping = relation.indexes.filter((index) => index.valid !== false && index.columns.some((column) => candidate.columns.some((candidateColumn) => candidateColumn.toLowerCase() === column.toLowerCase())));
  if (overlapping.length) return { status: "overlap-review" as const, detail: `${overlapping.map((index) => index.name).join(", ")} overlap candidate keys without the same leading prefix. Review consolidation, ordering, predicates, expressions, and INCLUDE columns before any experiment.` };
  return { status: "qualified-candidate" as const, detail: `Context confirms the relation and column(s), with no valid leading-column match among ${relation.indexes.length} imported index(es). This remains a test candidate; workload selectivity and write cost still require validation.` };
}
