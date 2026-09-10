import { findContextRelation, type DatabaseContext } from "./database-context.ts";
import type { EvidenceClassification, PlanVisualNode } from "./types.ts";

export type StatisticsSignal = "no-material-drift" | "plan-only" | "relation-not-found" | "context-incomplete" | "modification-pressure" | "extended-statistics-candidate" | "extended-statistics-present" | "single-column-review";
export interface StatisticsDiagnosis { signal: StatisticsSignal; classification: EvidenceClassification; node: PlanVisualNode | null; summary: string; evidence: string; unknown: string; nextAction: string }

const rowProducer = (node: PlanVisualNode) => /scan|join|aggregate|group|unique|setop|values/i.test(node.nodeType);
export function firstEstimateDivergence(nodes: PlanVisualNode[]) {
  return nodes.filter((node) => rowProducer(node) && (node.estimateRatio ?? 0) >= 10).sort((a, b) => b.depth - a.depth || (b.estimateRatio ?? 0) - (a.estimateRatio ?? 0))[0] ?? null;
}

function predicateColumns(node: PlanVisualNode, available: string[]) {
  const expression = [node.predicate, ...(node.expressions ?? []).filter((item) => /cond|filter/i.test(item.source)).map((item) => item.text)].join(" ").toLowerCase();
  return available.filter((column) => {
    const escaped = column.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9_$])(?:[a-z0-9_$]+\\.)?\"?${escaped}\"?(?=$|[^a-z0-9_$])`, "i").test(expression);
  });
}

export function statisticsDiagnosis(nodes: PlanVisualNode[], context: DatabaseContext | null): StatisticsDiagnosis {
  const node = firstEstimateDivergence(nodes);
  if (!node) return { signal: "no-material-drift", classification: "observed", node: null, summary: "No row-producing operation crossed the 10× estimate-drift threshold.", evidence: "Actual Rows and Plan Rows remain within the current diagnostic threshold.", unknown: "Parameter sensitivity and unobserved workload variation are not established by one plan.", nextAction: "Retain representative plans and compare again if runtime or plan shape changes." };
  const drift = `${node.estimateRatio!.toFixed(1)}× Actual Rows versus Plan Rows at ${node.nodeType}`;
  if (!context) return { signal: "plan-only", classification: "unknown", node, summary: "Estimate drift is observed; its statistics cause is not established.", evidence: drift, unknown: "Statistics freshness, column distributions, extended statistics, and parameter skew were not imported.", nextAction: "Import a sanitized Database Context Pack or inspect pg_stat_all_tables, pg_stats, and pg_statistic_ext before changing statistics." };
  const relation = findContextRelation(context, node.relation);
  if (!relation) return { signal: "relation-not-found", classification: "unknown", node, summary: "Estimate drift is observed, but no matching relation context was found.", evidence: drift, unknown: `The Context Pack does not identify statistics for ${node.relation}.`, nextAction: "Collect context for the plan's schemas and verify that aliases or view outputs resolve to the underlying relation." };
  if (context.availability.relationStats.status !== "captured" || context.availability.columnStats.status !== "captured") return { signal: "context-incomplete", classification: "unknown", node, summary: "The imported context is insufficient to qualify the statistics hypothesis.", evidence: drift, unknown: "Relation or column statistics were marked unavailable by the collector.", nextAction: "Recollect the Context Pack with access to pg_stat_all_tables and pg_stats; do not infer stale statistics from the plan alone." };

  const live = Math.max(0, relation.liveTuples ?? relation.rowEstimate ?? 0), modifications = Math.max(0, relation.modificationsSinceAnalyze ?? 0);
  const modificationRatio = live > 0 ? modifications / live : 0;
  if (modifications >= 10_000 && modificationRatio >= 0.2) return { signal: "modification-pressure", classification: "suspected", node, summary: "Post-ANALYZE modifications make statistics freshness a qualified hypothesis.", evidence: `${drift}; ${modifications.toLocaleString()} modifications since ANALYZE equal ${(modificationRatio * 100).toFixed(1)}% of approximately ${live.toLocaleString()} live rows.`, unknown: "This does not prove that the changed rows affect the predicate distribution or caused the selected plan.", nextAction: "Run targeted ANALYZE in a controlled environment, recapture with identical parameters, and accept the hypothesis only if estimates and plan quality improve." };

  const columns = predicateColumns(node, relation.columns.map((column) => column.name));
  if (columns.length >= 2) {
    const covering = (relation.extendedStatistics ?? []).find((statistic) => columns.every((column) => statistic.columns.some((entry) => entry.toLowerCase() === column.toLowerCase())));
    if (!covering) return { signal: "extended-statistics-candidate", classification: "suspected", node, summary: "The predicate uses multiple captured columns without covering extended statistics.", evidence: `${drift}; predicate columns ${columns.join(", ")} were captured, but no dependency/MCV/ndistinct statistic covers them together.`, unknown: "Cross-column dependence and workload recurrence are not proven by this plan.", nextAction: "Inspect data dependence, then test CREATE STATISTICS on the relevant column combination in a controlled environment and compare the after plan." };
    return { signal: "extended-statistics-present", classification: "observed", node, summary: "Covering extended statistics already exist; do not recommend a duplicate statistics object.", evidence: `${drift}; ${covering.name} covers ${columns.join(", ")} with ${covering.kinds.join(", ")}.`, unknown: "Freshness, sample quality, parameter skew, expression semantics, and whether the statistic was usable remain unverified.", nextAction: "Verify ANALYZE timing and predicate semantics, then compare representative parameter sets before increasing statistics targets." };
  }

  const column = columns.length === 1 ? relation.columns.find((item) => item.name.toLowerCase() === columns[0].toLowerCase()) : null;
  return { signal: "single-column-review", classification: column ? "observed" : "unknown", node, summary: column ? "Column statistics exist, but the estimate drift still needs controlled investigation." : "The predicate column could not be matched safely to imported column statistics.", evidence: column ? `${drift}; ${column.name} has statistics target ${column.statisticsTarget ?? "not captured"}, n_distinct ${column.nDistinct ?? "not captured"}, and correlation ${column.correlation ?? "not captured"}.` : drift, unknown: "Histogram/MCV values are intentionally redacted; data skew, parameter sensitivity, and expression semantics are not established.", nextAction: "Inspect the redacted-safe summary with a DBA, test a targeted statistics adjustment only when justified, and require a comparable after plan." };
}
