import { findContextRelation, type DatabaseContext } from "./database-context.ts";
import { coercionEvidence, type CoercionEvidence } from "./type-coercion.ts";
import type { EvidenceClassification, PlanVisualNode } from "./types.ts";

export type CoercionSignal = "none" | "predicate-coercion" | "set-operation-output" | "materialized-view-output" | "output-coercion";
export interface TypeCoercionDiagnosis { signal: CoercionSignal; classification: EvidenceClassification; node: PlanVisualNode | null; cast: CoercionEvidence | null; summary: string; evidence: string; unknown: string; nextAction: string }

function hasSetOperationAncestor(nodes: PlanVisualNode[], node: PlanVisualNode) {
  return nodes.some((candidate) => /append|setop/i.test(candidate.nodeType) && node.path.startsWith(`${candidate.path}.`));
}

export function typeCoercionDiagnosis(nodes: PlanVisualNode[], context: DatabaseContext | null): TypeCoercionDiagnosis {
  const matches = nodes.flatMap((node) => coercionEvidence(node.expressions ?? []).map((cast) => ({ node, cast })));
  const match = matches.sort((a, b) => Number(b.cast.context === "predicate") - Number(a.cast.context === "predicate") || b.node.timeShare - a.node.timeShare)[0];
  if (!match) return { signal: "none", classification: "observed", node: null, cast: null, summary: "No column-expression cast is visible in captured plan fields.", evidence: "Index conditions, join/filter predicates, and output expressions contain no supported column cast syntax.", unknown: "SQL text and view or UNION definitions may still contain transformations not emitted in this plan.", nextAction: "No type-alignment change is justified from this plan." };
  const { node, cast } = match;
  const visible = `${cast.source}: ${cast.expression}`;
  if (cast.context === "predicate") return { signal: "predicate-coercion", classification: "observed", node, cast, summary: "A column-expression cast is visible in a predicate.", evidence: `${visible}; target type ${cast.targetType}${cast.operand ? `; operand ${cast.operand}` : ""}.`, unknown: "The plan does not prove that the cast prevented index use, caused material runtime, or originated in a view, UNION branch, or parameter type.", nextAction: "Compare operand types from SQL/view definitions and sanitized context; align the originating expression, then require the cast to disappear in a comparable after plan." };
  if (hasSetOperationAncestor(nodes, node)) return { signal: "set-operation-output", classification: "suspected", node, cast, summary: "Output coercion beneath a set operation is consistent with branch type reconciliation.", evidence: `${visible}; an Append/SetOp ancestor is captured.`, unknown: "The plan does not identify which UNION/UNION ALL branch declared the wider type or whether the conversion is material to runtime.", nextAction: "Inspect every set-operation branch output and explicitly align corresponding column types; recapture and verify the output cast disappears." };
  const relation = findContextRelation(context, node.relation);
  if (relation?.kind === "materialized-view") return { signal: "materialized-view-output", classification: "suspected", node, cast, summary: "Output coercion is visible at a materialized-view access boundary.", evidence: `${visible}; sanitized context identifies ${relation.schema}.${relation.name} as a materialized view.`, unknown: "The context does not include the view definition, so the originating branch or expression remains unverified.", nextAction: "Inspect the materialized-view definition and source expression types, align them explicitly, refresh in a controlled environment, and compare the after plan." };
  return { signal: "output-coercion", classification: "observed", node, cast, summary: "A column-expression cast is visible in the output list.", evidence: `${visible}; target type ${cast.targetType}.`, unknown: "Output coercion alone does not establish access-path loss or material runtime impact.", nextAction: "Trace the output to its view, set-operation branch, function, or client contract before changing schema or SQL." };
}
