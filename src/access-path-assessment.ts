import type { PlanVisualNode } from "./types.ts";
import { indexOnlyScanDiagnosis } from "./index-only-scan-diagnosis.ts";

export type AccessPathLevel = "good" | "review" | "info";
export interface AccessPathAssessment {
  level: AccessPathLevel;
  label: "Good" | "Review" | "Information";
  summary: string;
  reason: string;
  nextAction: string;
}

export function accessPathAssessment(node: PlanVisualNode): AccessPathAssessment {
  const estimateDrift = node.estimateRatio ?? 0;
  const repeated = node.loops >= 500;
  const readHeavy = node.sharedReads >= 1_000;
  const materialTime = node.timeShare >= 20;

  if (/seq scan/i.test(node.nodeType)) {
    if (estimateDrift >= 10) return {
      level: "review", label: "Review",
      summary: "The planner's row estimate may have influenced sequential access.",
      reason: `${estimateDrift.toFixed(1)}× actual-versus-planned row drift is captured at this scan.`,
      nextAction: "Check ANALYZE freshness, column statistics, correlation, and data skew before testing another access path.",
    };
    if (node.predicate && (readHeavy || materialTime)) return {
      level: "review", label: "Review",
      summary: "Filtered sequential access performs material measured work.",
      reason: `${node.sharedReads.toLocaleString()} shared reads and ${node.timeShare.toFixed(1)}% of runtime are attributed inclusively to this node.`,
      nextAction: "Compare qualifying rows with table size, inspect existing indexes, and test a candidate only with an after plan.",
    };
    return {
      level: "info", label: "Information",
      summary: node.predicate ? "A sequential scan applies a filter while reading the relation." : "A full sequential scan reads the relation without a captured filter.",
      reason: "Sequential access can be correct for small tables or queries returning a large portion of the relation.",
      nextAction: "Confirm relation size and returned-row percentage before considering an index.",
    };
  }

  if (/index only scan/i.test(node.nodeType)) {
    const diagnosis = indexOnlyScanDiagnosis(node)!;
    return { level: diagnosis.review ? "review" : diagnosis.signal === "effective" ? "good" : "info", label: diagnosis.review ? "Review" : diagnosis.signal === "effective" ? "Good" : "Information", summary: diagnosis.summary, reason: diagnosis.evidence, nextAction: diagnosis.nextAction };
  }

  if (/bitmap heap scan/i.test(node.nodeType)) return {
    level: estimateDrift >= 10 || repeated ? "review" : "info",
    label: estimateDrift >= 10 || repeated ? "Review" : "Information",
    summary: "PostgreSQL combined bitmap matches before visiting heap pages.",
    reason: "Bitmap access commonly suits a medium-sized result set; lossy blocks and recheck rows determine whether it degraded.",
    nextAction: "Inspect Exact/Lossy Heap Blocks, Rows Removed by Index Recheck, estimate drift, and work_mem evidence.",
  };

  if (/bitmap index scan/i.test(node.nodeType)) return {
    level: estimateDrift >= 10 ? "review" : "good", label: estimateDrift >= 10 ? "Review" : "Good",
    summary: "An index produced a bitmap for its parent heap scan.",
    reason: estimateDrift >= 10 ? `${estimateDrift.toFixed(1)}× estimate drift can distort the bitmap-versus-index decision.` : "No deterministic estimate or loop threshold was crossed at this bitmap index node.",
    nextAction: "Evaluate this node together with its parent Bitmap Heap Scan; do not judge it in isolation.",
  };

  if (/index scan/i.test(node.nodeType)) return repeated ? {
    level: "review", label: "Review",
    summary: "Targeted index access is amplified by repeated execution.",
    reason: `${node.loops.toLocaleString()} index probes were captured. An index choice can still be expensive when driven by a nested loop.`,
    nextAction: "Inspect the parent join, rows per loop, cache behavior, and whether the outer input can be reduced.",
  } : {
    level: estimateDrift >= 10 ? "review" : "good", label: estimateDrift >= 10 ? "Review" : "Good",
    summary: "PostgreSQL used targeted index access.",
    reason: estimateDrift >= 10 ? `${estimateDrift.toFixed(1)}× estimate drift still deserves review.` : "No deterministic estimate, loop, or read threshold was crossed at this node.",
    nextAction: "Confirm the index condition, returned rows, and total time under representative parameters.",
  };

  return {
    level: "info", label: "Information",
    summary: `PostgreSQL used ${node.nodeType}.`,
    reason: "The pasted plan identifies the method, but this tool has no catalog or table-size context.",
    nextAction: "Review the raw node evidence and compare it with its parent operation before changing the access path.",
  };
}
