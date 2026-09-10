import { useEffect, useMemo, useRef, useState } from "react";
import type { PlanVisualNode } from "../types.ts";
import { nodeSignal } from "../node-signal.ts";
import { rootCauseTrace } from "../root-cause-trace.ts";
import { coercionEvidence } from "../type-coercion.ts";

type Metric = "time" | "self" | "rows" | "drift" | "buffers";
interface GraphItem { node: PlanVisualNode; children: GraphItem[] }

const number = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
const parentPath = (path: string) => path.split(".").slice(0, -1).join(".");
const metricLabel: Record<Metric, string> = { time: "Inclusive time", self: "Self time", rows: "Rows × loops", drift: "Estimate drift", buffers: "Shared reads" };

function metricValue(node: PlanVisualNode, metric: Metric) {
  if (metric === "time") return node.totalTime;
  if (metric === "self") return node.selfTime;
  if (metric === "rows") return node.rows * Math.max(1, node.loops);
  if (metric === "drift") return node.estimateRatio ?? 0;
  return node.sharedReads;
}

function metricText(node: PlanVisualNode, metric: Metric) {
  const value = metricValue(node, metric);
  return metric === "time" || metric === "self" ? `${number(value, 2)} ms` : metric === "drift" ? `${number(value, 1)}×` : number(value);
}

function makeTree(nodes: PlanVisualNode[]): GraphItem | null {
  const items = new Map(nodes.map((node) => [node.path, { node, children: [] } as GraphItem]));
  let root: GraphItem | null = null;
  for (const item of items.values()) {
    const parent = items.get(parentPath(item.node.path));
    if (parent) parent.children.push(item); else root = item;
  }
  return root;
}

function GraphBranch({ item, selected, metric, max, collapsed, compact, onSelect, onCollapse }: { item: GraphItem; selected?: string; metric: Metric; max: number; collapsed: Set<string>; compact: boolean; onSelect: (node: PlanVisualNode) => void; onCollapse: (path: string) => void }) {
  const { node } = item;
  const signal = nodeSignal(node);
  const hidden = collapsed.has(node.path);
  const share = max > 0 ? Math.max(2, metricValue(node, metric) / max * 100) : 0;
  return <div className={`visual-graph-branch ${compact ? "compact" : ""}`} style={{ "--edge-opacity": Math.max(.22, share / 100), "--edge-width": `${Math.max(1, Math.min(7, share / 18))}px` } as React.CSSProperties}>
    <div className="visual-graph-node-shell"><button data-node-path={node.path} className={`visual-graph-node signal-${signal.level} ${selected === node.path ? "selected" : ""}`} onClick={() => onSelect(node)} aria-label={`Select operation ${node.rank}: ${node.nodeType}`}>
      <span className="visual-node-number">#{node.rank}</span><i className="visual-node-signal">{signal.symbol}</i>
      <span className="visual-node-title"><strong>{node.nodeType}</strong><small>{node.relation === "—" ? `Operation ${node.rank}` : node.relation}</small></span>
      <span className="visual-node-metric"><b>{metricText(node, metric)}</b><small>{metricLabel[metric]}</small></span>
      <span className="visual-node-bar"><i style={{ width: `${share}%` }} /></span>
    </button>{item.children.length > 0 && <button className="visual-node-collapse" aria-label={`${hidden ? "Expand" : "Collapse"} branch ${node.rank}`} onClick={() => onCollapse(node.path)}>{hidden ? `+${item.children.length}` : "−"}</button>}</div>
    {!hidden && item.children.length > 0 && <div className="visual-graph-children">{item.children.map((child) => <GraphBranch key={child.node.path} item={child} selected={selected} metric={metric} max={max} collapsed={collapsed} compact={compact} onSelect={onSelect} onCollapse={onCollapse} />)}</div>}
  </div>;
}

export function VisualPlanExplorer({ nodes, selected, onSelect }: { nodes: PlanVisualNode[]; selected: PlanVisualNode | null; onSelect: (node: PlanVisualNode) => void }) {
  const [metric, setMetric] = useState<Metric>("self");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const explorerRef = useRef<HTMLElement>(null);
  const relatedPath = (path: string, target: string) => path === target || path.startsWith(`${target}.`) || target.startsWith(`${path}.`);
  const focusedNodes = useMemo(() => !focus ? nodes : nodes.filter((node) => relatedPath(node.path, focus)), [focus, nodes]);
  const tree = useMemo(() => makeTree(focusedNodes), [focusedNodes]);
  const max = Math.max(0, ...focusedNodes.map((node) => metricValue(node, metric)));
  const trace = selected ? rootCauseTrace(nodes, selected) : null;
  const coercions = selected ? coercionEvidence(selected.expressions ?? []) : [];
  const toggle = (path: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  const revealNode = (targetPath: string) => window.setTimeout(() => {
      const canvas = explorerRef.current?.querySelector<HTMLElement>(".visual-graph-canvas");
      const operation = explorerRef.current?.querySelector<HTMLElement>(`.visual-graph-node[data-node-path="${targetPath}"]`);
      if (!canvas || !operation) return;
      const canvasRect = canvas.getBoundingClientRect(), operationRect = operation.getBoundingClientRect();
      canvas.scrollLeft += operationRect.left + operationRect.width / 2 - canvasRect.left - canvasRect.width / 2;
      if (operationRect.top < canvasRect.top || operationRect.bottom > canvasRect.bottom) canvas.scrollTop += operationRect.top - canvasRect.top - 28;
    }, 60);
  const selectNode = (node: PlanVisualNode) => { onSelect(node); setInspectorOpen(true); revealNode(node.path); };
  useEffect(() => {
    if (!nodes.length) return;
    const reveal = revealNode(nodes[0].path);
    return () => window.clearTimeout(reveal);
  }, [nodes]);
  useEffect(() => {
    if (!focus || !selected) return;
    const reveal = revealNode(selected.path);
    return () => window.clearTimeout(reveal);
  }, [focus]);

  return <section ref={explorerRef} className="visual-plan-explorer" aria-label="Visual execution plan explorer">
    <header className="visual-plan-toolbar"><div><strong>Plan explorer</strong><span>{nodes.length} operations{focus ? ` · focused on #${selected?.rank ?? "—"}` : ""}</span></div><nav aria-label="Plan metric">{(["time", "self", "rows", "drift", "buffers"] as Metric[]).map((item) => <button className={metric === item ? "active" : ""} key={item} onClick={() => setMetric(item)}>{item === "buffers" ? "Buffers" : item === "drift" ? "Estimation" : item === "self" ? "Self time" : item[0].toUpperCase() + item.slice(1)}</button>)}</nav><div className="visual-navigation-controls"><button aria-label="Zoom out plan" disabled={zoom <= .65} onClick={() => setZoom((value) => Math.max(.65, Number((value - .1).toFixed(2))))}>−</button><output aria-label="Plan zoom">{Math.round(zoom * 100)}%</output><button aria-label="Zoom in plan" disabled={zoom >= 1.35} onClick={() => setZoom((value) => Math.min(1.35, Number((value + .1).toFixed(2))))}>+</button><button aria-label="Reset plan zoom" onClick={() => setZoom(1)}>100%</button><button onClick={() => setCompact((value) => !value)}>{compact ? "Comfortable density" : "Compact density"}</button><button disabled={!focus} onClick={() => setFocus(null)}>Reset focus</button></div></header>
    <div className="visual-plan-body">
      <aside className="metric-outline" aria-label="Metric operation outline"><header><strong>{metricLabel[metric]}</strong><small>Click an operation</small></header><div>{focusedNodes.map((node) => { const signal = nodeSignal(node); const share = max > 0 ? metricValue(node, metric) / max * 100 : 0; return <button data-node-path={node.path} className={selected?.path === node.path ? "selected" : ""} key={node.path} onClick={() => selectNode(node)} style={{ "--outline-depth": Math.min(node.depth, 8) } as React.CSSProperties}><span>#{node.rank}</span><i className={`signal-${signal.level}`}>{signal.symbol}</i><strong>{node.nodeType}</strong><em><b style={{ width: `${share}%` }} /></em><small>{metricText(node, metric)}</small></button>; })}</div></aside>
      <div className={`visual-graph-canvas ${compact ? "compact" : ""}`} aria-label="Connected execution plan graph"><div className="visual-canvas-key"><span><i className="critical" />Issue</span><span><i className="review" />Review</span><span><i className="healthy" />Within checks</span></div><div className="visual-graph-stage" style={{ "--plan-zoom": zoom } as React.CSSProperties}>{tree ? <GraphBranch item={tree} selected={selected?.path} metric={metric} max={max} collapsed={collapsed} compact={compact} onSelect={selectNode} onCollapse={toggle} /> : <p>No operations match this focus.</p>}</div>{selected && inspectorOpen && <aside className="visual-node-inspector" aria-label="Visual plan node inspector"><header><div><span>Operation #{selected.rank}</span><strong>{selected.nodeType}</strong><small>{selected.relation}</small></div><button aria-label="Close node inspector" onClick={() => setInspectorOpen(false)}>×</button></header><div className={`inspector-verdict signal-${nodeSignal(selected).level}`}><i>{nodeSignal(selected).symbol}</i><p><strong>{nodeSignal(selected).label}</strong><span>{nodeSignal(selected).reason}</span></p></div><dl><div><dt>Self / inclusive</dt><dd>{number(selected.selfTime, 2)} / {number(selected.totalTime, 2)} ms</dd></div><div><dt>Rows × loops</dt><dd>{number(selected.rows)} × {number(Math.max(1, selected.loops))}</dd></div><div><dt>Estimate drift</dt><dd>{selected.estimateRatio == null ? "Not captured" : `${number(selected.estimateRatio, 1)}×`}</dd></div><div><dt>Reads / temp</dt><dd>{number(selected.sharedReads)} / {number(selected.tempBlocks)}</dd></div></dl>{trace && <section><span>Causal trace</span><strong>{trace.chain.map((node) => node.nodeType).join(" → ")}</strong><p>Investigate first: {trace.origin.nodeType} · operation {trace.origin.rank}</p></section>}<section><span>Predicate</span><code>{selected.predicate || "No predicate captured."}</code></section>{coercions.length > 0 && <section className="inspector-coercion"><span>Type coercion</span><strong>{coercions.map((item) => item.targetType).join(", ")}</strong><p>Visible in the plan; runtime impact and origin require validation.</p></section>}<button className="focus-branch" onClick={() => setFocus(selected.path)}>Focus this branch</button></aside>}</div>
    </div>
  </section>;
}
