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
  // Deliberately small grammar: never salvage keys from an unsupported expression.
  // Replace complete SQL literals before inspecting operators or parentheses.
  const masked = predicate.replace(/'(?:''|[^'])*'/g, "0");
  if (/\b(?!AND\b)[a-z_][\w$]*\s*\(/i.test(masked)) return [];
  if (/[;'"\\]/.test(masked)) return [];
  let depth = 0;
  for (const char of masked) {
    if (char === "(") depth++;
    if (char === ")" && --depth < 0) return [];
  }
  if (depth !== 0) return [];
  const clauses = masked.replace(/[()]/g, " ").split(/\bAND\b/i);
  const columns = new Map<string, string>();
  const pattern = /^\s*((?:[a-z_][\w$]*\.)?[a-z_][\w$]*)\s*(=|<=|>=|<|>)\s*(?:[+-]?\d+(?:\.\d+)?|true|false|\$\d+)\s*$/i;
  for (const clause of clauses) {
    const match = clause.match(pattern);
    if (!match) return [];
    const column = match[1].split(".").at(-1)!.toLowerCase();
    if (columns.get(column) !== "=") columns.set(column, match[2]);
  }
  if (columns.size > 3) return [];
  return [...columns].map(([column, operator]) => ({ column, operator })).sort((a, b) => Number(b.operator === "=") - Number(a.operator === "="));
}

export function indexCandidate(node: PlanVisualNode | null): IndexCandidate | null {
  if (!node || !/seq scan/i.test(node.nodeType) || node.relation === "—" || !node.predicate) return null;
  if (!/^[a-z_][\w$]*(\.[a-z_][\w$]*)?$/i.test(node.relation)) return null;
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
  if (context.availability.indexStats.status !== "captured") return { status: "context-incomplete" as const, detail: "Index inventory was not captured. An empty list does not establish that no index exists." };
  const missingColumns = candidate.columns.filter((column) => !relation.columns.some((item) => item.name === column));
  if (missingColumns.length) return { status: "column-mismatch" as const, detail: `Context does not contain candidate column(s): ${missingColumns.join(", ")}. Verify plan aliases and schema before testing DDL.` };
  const covering = relation.indexes.find((index) => index.valid === true && index.ready === true && index.accessMethod === "btree" && index.hasPredicate === false && index.hasExpressions === false && candidate.columns.every((column, position) => index.columns[position] === column));
  if (covering) return { status: "existing-index" as const, detail: `${covering.name} already begins with (${candidate.columns.join(", ")}). Investigate usability, predicate/type compatibility, statistics, and planner choice instead of creating a duplicate.` };
  const overlapping = relation.indexes.filter((index) => [...index.columns, ...(index.includeColumns ?? [])].some((column) => candidate.columns.includes(column)) || index.hasExpressions !== false || index.hasPredicate !== false);
  if (overlapping.length) return { status: "overlap-review" as const, detail: `${overlapping.map((index) => index.name).join(", ")} require review. Key overlap does not prove usable coverage: verify validity, readiness, access method, leading keys, partial predicates and expressions. INCLUDE columns are not search keys. Missing metadata remains unknown.` };
  return { status: "qualified-candidate" as const, detail: `Context confirms the relation and column(s), with no valid leading-column match among ${relation.indexes.length} imported index(es). This remains a test candidate; workload selectivity and write cost still require validation.` };
}
