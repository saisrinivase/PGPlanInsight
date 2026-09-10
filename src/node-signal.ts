import type { PlanVisualNode } from "./types.ts";

export type NodeSignalLevel = "critical" | "review" | "healthy" | "unknown";
export interface NodeSignal { level: NodeSignalLevel; symbol: string; label: string; reason: string }

const passesRowsThrough = (nodeType: string) => /^(sort|incremental sort|limit|gather|gather merge|materialize|memoize|unique|lockrows|result)$/i.test(nodeType);

export function nodeSignal(node: PlanVisualNode): NodeSignal {
  if (node.loops <= 0) return { level: "unknown", symbol: "?", label: "Unknown", reason: "Actual execution counters are unavailable" };
  if (node.spillRole === "direct") {
    const ioTime = node.tempReadTime + node.tempWriteTime;
    return { level: "critical", symbol: "×", label: "Spill source", reason: `${node.tempReadBlocks.toLocaleString()} temp blocks read and ${node.tempWrittenBlocks.toLocaleString()} written${node.spillMethod ? ` by ${node.spillMethod}` : " at this operation"}${ioTime > 0 ? `; captured temp I/O time ${ioTime.toFixed(1)} ms` : ""}` };
  }
  if ((node.estimateRatio ?? 0) >= 100) return passesRowsThrough(node.nodeType)
    ? { level: "critical", symbol: "×", label: "Estimate issue", reason: `${node.estimateRatio?.toFixed(1)}× row-estimate mismatch is visible at this ${node.nodeType}, but this operator commonly inherits rows; trace the first child where actual rows diverge` }
    : { level: "critical", symbol: "×", label: "Estimate issue", reason: `${node.estimateRatio?.toFixed(1)}× row-estimate mismatch; verify statistics, selectivity, correlation, and data skew at this row-producing operation` };
  if (node.loops >= 1_000 && node.timeShare >= 20) return { level: "critical", symbol: "×", label: "Bottleneck", reason: `${node.loops.toLocaleString()} loops amplify a material share of runtime` };
  if ((node.estimateRatio ?? 0) >= 10) return passesRowsThrough(node.nodeType)
    ? { level: "review", symbol: "!", label: "Review estimate", reason: `${node.estimateRatio?.toFixed(1)}× row-estimate mismatch is visible here; trace the child branch before attributing the cause to ${node.nodeType}` }
    : { level: "review", symbol: "!", label: "Review estimate", reason: `${node.estimateRatio?.toFixed(1)}× row-estimate mismatch; verify statistics, selectivity, and correlation` };
  if (node.loops >= 500) return { level: "review", symbol: "!", label: "Review", reason: `${node.loops.toLocaleString()} executions may amplify inner work` };
  if (node.spillRole === "inherited") return { level: "review", symbol: "!", label: "Inherited temp I/O", reason: `${node.tempReadBlocks.toLocaleString()} temp blocks read and ${node.tempWrittenBlocks.toLocaleString()} written are inclusive descendant evidence; trace the direct spill operation` };
  if (node.flags.includes("scan")) return { level: "review", symbol: "!", label: "Review", reason: "Sequential scan; validate selectivity and rows removed before changing the access path" };
  return { level: "healthy", symbol: "✓", label: "Within checks", reason: "No deterministic node threshold was crossed" };
}
