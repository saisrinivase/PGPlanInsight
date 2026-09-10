import type { PlanVisualNode } from "./types.ts";

export type TraceKind = "cardinality" | "runtime" | "spill";
export interface RootCauseTrace {
  kind: TraceKind;
  confidence: "High" | "Medium";
  chain: PlanVisualNode[];
  origin: PlanVisualNode;
  summary: string;
  boundary: string;
}

const directChildren = (nodes: PlanVisualNode[], parent: PlanVisualNode) => nodes.filter((node) => node.depth === parent.depth + 1 && node.path.startsWith(`${parent.path}.`));

function spillTrace(nodes: PlanVisualNode[], observed: PlanVisualNode): RootCauseTrace | null {
  if (observed.spillRole !== "inherited") return null;
  const sources = nodes.filter((node) => node.spillRole === "direct" && node.path.startsWith(`${observed.path}.`));
  if (!sources.length) return null;
  const origin = sources.sort((a, b) => b.tempBlocks - a.tempBlocks || b.depth - a.depth)[0];
  const chain = nodes.filter((node) => (node.path === observed.path || node.path.startsWith(`${observed.path}.`)) && (origin.path === node.path || origin.path.startsWith(`${node.path}.`)));
  return {
    kind: "spill",
    confidence: "High",
    chain,
    origin,
    summary: `Temporary I/O is visible inclusively at ${observed.nodeType}. ${origin.nodeType} is the descendant operation with direct spill evidence${origin.spillMethod ? ` (${origin.spillMethod})` : ""}.`,
    boundary: "Ancestor buffer counters include descendant work. Attribute the spill to the direct operation, then compare its captured I/O time with total runtime before calling it dominant.",
  };
}

function estimateTrace(nodes: PlanVisualNode[], observed: PlanVisualNode): RootCauseTrace | null {
  if ((observed.estimateRatio ?? 0) < 10) return null;
  const chain = [observed];
  let current = observed;
  while (true) {
    const candidates = directChildren(nodes, current).filter((child) => (child.estimateRatio ?? 0) >= 10).sort((a, b) => (b.estimateRatio ?? 0) - (a.estimateRatio ?? 0));
    if (!candidates.length) break;
    current = candidates[0];
    chain.push(current);
  }
  const origin = chain.at(-1)!;
  return {
    kind: "cardinality",
    confidence: chain.every((node) => node.plannedRows >= 0 && node.rows >= 0) ? "High" : "Medium",
    chain,
    origin,
    summary: chain.length > 1 ? `Estimate drift is visible at ${observed.nodeType} and remains material through ${origin.nodeType}. Investigate the deepest evidenced divergence first.` : `${observed.nodeType} is the first captured node in this branch with material estimate drift.`,
    boundary: "This locates the first divergence visible in the pasted plan; it does not prove whether statistics, parameter skew, correlation, or predicate semantics caused it.",
  };
}

function runtimeTrace(nodes: PlanVisualNode[], observed: PlanVisualNode): RootCauseTrace | null {
  if (observed.totalTime <= 0) return null;
  const chain = [observed];
  let current = observed;
  while (current.totalTime > 0 && current.selfTime / current.totalTime <= 0.15) {
    const child = directChildren(nodes, current).sort((a, b) => b.totalTime - a.totalTime)[0];
    if (!child || child.totalTime / current.totalTime < 0.5) break;
    current = child;
    chain.push(current);
  }
  if (chain.length < 2) return null;
  const origin = chain.at(-1)!;
  return {
    kind: "runtime",
    confidence: "Medium",
    chain,
    origin,
    summary: `${observed.nodeType} inclusive time is dominated by its child branch. ${origin.nodeType} is the deepest material operation supported by captured timing.`,
    boundary: "Self time is approximate because PostgreSQL reports inclusive node timing; confirm with repeated execution and representative cache state.",
  };
}

export function rootCauseTrace(nodes: PlanVisualNode[], observed: PlanVisualNode): RootCauseTrace | null {
  return spillTrace(nodes, observed) ?? estimateTrace(nodes, observed) ?? runtimeTrace(nodes, observed);
}
