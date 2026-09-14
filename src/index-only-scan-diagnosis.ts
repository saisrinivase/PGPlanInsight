import type { EvidenceClassification, PlanVisualNode } from "./types.ts";

export type IndexOnlyScanSignal = "estimated-only" | "heap-fetch-heavy" | "residual-filter" | "loop-amplified" | "effective" | "incomplete";

export interface IndexOnlyScanDiagnosis {
  signal: IndexOnlyScanSignal;
  classification: EvidenceClassification;
  review: boolean;
  summary: string;
  evidence: string;
  nextAction: string;
}

function measuredProfile(node: PlanVisualNode, totalRows: number, removed: number): string {
  const heap = node.heapFetches == null ? "Heap Fetches not captured" : `Heap Fetches ${node.heapFetches.toLocaleString()}`;
  return `${node.totalTime.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms (${node.timeShare.toFixed(1)}% of execution); ${node.loops.toLocaleString()} loop(s); ${totalRows.toLocaleString()} returned row visits; ${node.sharedReads.toLocaleString()} shared reads; ${heap}; ${removed.toLocaleString()} rows removed by filter.`;
}

export function indexOnlyScanDiagnosis(node: PlanVisualNode): IndexOnlyScanDiagnosis | null {
  if (!/index only scan/i.test(node.nodeType)) return null;
  const totalRows = node.rows * Math.max(1, node.loops);
  const removed = (node.rowsRemovedByFilter ?? 0) * Math.max(1, node.loops);
  const actualTimingCaptured = node.actualTimingCaptured ?? (node.totalTime > 0 && node.loops > 0);

  if (!actualTimingCaptured) return {
    signal: "estimated-only", classification: "unknown", review: false,
    summary: "Runtime behavior is not established for this index-only scan.",
    evidence: "The plan has no Actual Time, Actual Rows, or Actual Loops for this operation; estimated cost does not prove runtime impact.",
    nextAction: "Capture EXPLAIN (ANALYZE, BUFFERS, VERBOSE) before diagnosing heap access or loop amplification.",
  };

  if (node.heapFetches != null && node.heapFetches >= 100 && node.heapFetches >= Math.max(1, totalRows) * 0.1) return {
    signal: "heap-fetch-heavy", classification: "observed", review: true,
    summary: "Heap visits reduced the benefit of this index-only scan.",
    evidence: `Heap visits were ${((node.heapFetches / Math.max(1, totalRows)) * 100).toFixed(1)}% of returned row visits. ${measuredProfile(node, totalRows, removed)}`,
    nextAction: "Check visibility-map coverage and vacuum health; validate heap fetches and runtime after normal autovacuum or a controlled maintenance test.",
  };

  if (removed >= 1_000 && removed >= Math.max(1, totalRows)) return {
    signal: "residual-filter", classification: "observed", review: true,
    summary: "The index-only scan discarded substantial rows after index access.",
    evidence: `${removed.toLocaleString()} rows were removed by a residual filter versus ${totalRows.toLocaleString()} returned row visits. ${measuredProfile(node, totalRows, removed)}`,
    nextAction: "Inspect Index Cond versus Filter and test whether predicate/index key order or an expression/partial-index experiment reduces filtered work.",
  };

  if (node.loops >= 100 && (node.timeShare >= 10 || node.totalTime >= 100)) return {
    signal: "loop-amplified", classification: "derived", review: true,
    summary: "Fast index-only probes accumulated material time through repetition.",
    evidence: `Repeated probes are the dominant measured concern. ${measuredProfile(node, totalRows, removed)}`,
    nextAction: "Trace the outer join cardinality and compare a controlled plan that reduces probes; do not create another index solely because this node is expensive in aggregate.",
  };

  if (node.heapFetches === 0) return {
    signal: "effective", classification: "observed", review: false,
    summary: "This index-only scan avoided heap visits in the captured execution.",
    evidence: `Heap Fetches = 0. ${measuredProfile(node, totalRows, removed)}`,
    nextAction: "Keep the access path unless representative repeated runs show material time or another measured regression.",
  };

  return {
    signal: "incomplete", classification: "unknown", review: false,
    summary: "Index-only access was used, but heap-visit efficiency is unknown.",
    evidence: "Heap Fetches was not captured in the supplied plan.",
    nextAction: "Capture EXPLAIN (ANALYZE, BUFFERS) and inspect Heap Fetches before judging visibility-map effectiveness.",
  };
}
