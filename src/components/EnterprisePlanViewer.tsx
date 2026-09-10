import { useMemo, useState } from "react";
import { nodeSignal, type NodeSignalLevel } from "../node-signal.ts";
import type { Analysis, PlanVisualNode } from "../types.ts";

type MetricMode = "time" | "rows" | "io";
type RiskFilter = "all" | "critical" | "review";

const compact = (value: number) => Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
const ms = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`;
const drift = (value: number | null) => value == null ? "N/A" : `${value.toFixed(1)}×`;
const parentPath = (path: string) => path.split(".").slice(0, -1).join(".");

function metricValue(node: PlanVisualNode, mode: MetricMode) {
  if (mode === "rows") return node.rows * Math.max(1, node.loops);
  if (mode === "io") return node.sharedReads + node.tempBlocks;
  return node.totalTime;
}

function operatorExplanation(node: PlanVisualNode) {
  if (/Nested Loop/i.test(node.nodeType)) return "For each outer row, PostgreSQL executes the inner branch. Loop count and inner access cost determine whether this shape scales.";
  if (/Hash Join/i.test(node.nodeType)) return "PostgreSQL builds a hash table from one input and probes it with the other. Inspect batches, temporary I/O and estimate quality.";
  if (/Merge Join/i.test(node.nodeType)) return "Both inputs must arrive in join-key order. Inspect supporting indexes or sort work and the number of rows entering the merge.";
  if (/Seq Scan/i.test(node.nodeType)) return "PostgreSQL reads the relation sequentially. This can be correct for broad retrieval; validate selectivity and rows removed before proposing an index.";
  if (/Index Only Scan/i.test(node.nodeType)) return "The index can provide required columns, but heap fetches may still occur when visibility-map evidence is unavailable.";
  if (/Index|Bitmap/i.test(node.nodeType)) return "This access path uses indexable conditions. Compare rows found, heap work, loops and random-read pressure.";
  if (/Sort/i.test(node.nodeType)) return "The node orders its input. Temporary blocks or an external sort method indicate that work exceeded available in-memory capacity.";
  if (/Aggregate/i.test(node.nodeType)) return "The node groups or reduces input rows. Check input cardinality, memory use and spill evidence.";
  if (/Gather/i.test(node.nodeType)) return "The leader combines parallel-worker output. Compare planned and launched workers and account for leader merge/collection overhead.";
  return "Read this operator with its children: inclusive time contains descendant work, while approximate self time isolates work attributed here.";
}

export function EnterprisePlanViewer({ result }: { result: Analysis }) {
  const [selectedPath, setSelectedPath] = useState(result.planMap[0]?.path ?? "");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [mode, setMode] = useState<MetricMode>("time");
  const selected = result.planMap.find((node) => node.path === selectedPath) ?? result.planMap[0];
  const maxMetric = Math.max(1, ...result.planMap.map((node) => metricValue(node, mode)));
  const statusCounts = result.planMap.reduce((counts, node) => { counts[nodeSignal(node).level] += 1; return counts; }, { critical: 0, review: 0, healthy: 0, unknown: 0 } as Record<NodeSignalLevel, number>);
  const children = useMemo(() => new Set(result.planMap.map((node) => parentPath(node.path)).filter(Boolean)), [result.planMap]);
  const visible = result.planMap.filter((node) => {
    const ancestors = node.path.split(".").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join("."));
    if (ancestors.some((path) => collapsed.has(path))) return false;
    const signal = nodeSignal(node);
    const riskMatch = risk === "all" || signal.level === risk;
    const textMatch = !query.trim() || `${node.path} ${node.nodeType} ${node.relation} ${node.predicate}`.toLowerCase().includes(query.trim().toLowerCase());
    if (riskMatch && textMatch) return true;
    if (!query.trim() && risk !== "all") return result.planMap.some((candidate) => candidate.path.startsWith(`${node.path}.`) && nodeSignal(candidate).level === risk);
    return false;
  });
  const toggle = (path: string) => setCollapsed((current) => { const next = new Set(current); next.has(path) ? next.delete(path) : next.add(path); return next; });
  const crumbs = selected ? selected.path.split(".").map((_, index, parts) => parts.slice(0, index + 1).join(".")).map((path) => result.planMap.find((node) => node.path === path)).filter((node): node is PlanVisualNode => Boolean(node)) : [];
  const signal = selected ? nodeSignal(selected) : null;

  return <section className="enterprise-viewer" aria-labelledby="enterprise-viewer-title">
    <div className="enterprise-viewer-title"><div><div className="section-kicker">Execution plan operations</div><h2 id="enterprise-viewer-title">Plan Viewer</h2><p>Trace work from child inputs to the result. Select any operation to inspect its measured evidence and interpretation.</p></div><div className="viewer-capture"><span>{result.format} · {result.adapter}</span><strong>{result.nodeCount} operations</strong></div></div>
    <div className="viewer-summary" aria-label="Plan Viewer summary"><div><span>Elapsed</span><strong>{result.executionTime == null ? "Not captured" : ms(result.executionTime)}</strong></div><div className="critical"><span>Bottlenecks</span><strong>{statusCounts.critical}</strong></div><div className="review"><span>Review</span><strong>{statusCounts.review}</strong></div><div><span>Shared reads</span><strong>{compact(result.metrics.rootSharedReads)}</strong></div><div><span>Temporary blocks</span><strong>{compact(result.metrics.rootTempBlocks)}</strong></div></div>
    <div className="viewer-console">
      <div className="viewer-tree-pane">
        <div className="viewer-toolbar"><label><span>Find operation</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Node, relation, predicate…" /></label><div className="viewer-filter" aria-label="Operation risk filter">{(["all", "critical", "review"] as RiskFilter[]).map((value) => <button className={risk === value ? "active" : ""} key={value} onClick={() => setRisk(value)}>{value === "all" ? "All" : value === "critical" ? "Bottlenecks" : "Review"}</button>)}</div><div className="viewer-filter" aria-label="Metric display">{(["time", "rows", "io"] as MetricMode[]).map((value) => <button className={mode === value ? "active" : ""} key={value} onClick={() => setMode(value)}>{value === "io" ? "I/O" : value}</button>)}</div></div>
        <div className="viewer-columns" aria-hidden="true"><span>Operation</span><span>Health</span><span>Actual / estimate</span><span>Loops</span><span>Inclusive / self</span><span>Reads / temp</span></div>
        <div className="operation-tree" role="tree" aria-label="Execution operation tree">{visible.map((node) => { const state = nodeSignal(node), hasChildren = children.has(node.path), isCollapsed = collapsed.has(node.path), width = metricValue(node, mode) / maxMetric * 100; return <div role="treeitem" aria-level={node.depth + 1} aria-selected={selected?.path === node.path} className={`operation-row signal-${state.level} ${selected?.path === node.path ? "selected" : ""}`} key={node.path} style={{ "--depth": node.depth, "--metric-width": `${Math.max(1, width)}%` } as React.CSSProperties}><div className="operation-name"><button className="tree-toggle" disabled={!hasChildren} aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.nodeType}`} onClick={() => hasChildren && toggle(node.path)}>{hasChildren ? isCollapsed ? "+" : "−" : "·"}</button><button className="operation-select" onClick={() => setSelectedPath(node.path)}><i /><span><strong>{node.nodeType}</strong><small>{node.relation === "—" ? node.path : `${node.relation} · ${node.path}`}</small></span></button></div><div className="operation-health"><i>{state.symbol}</i><span><b>{state.label}</b><small>{state.reason}</small></span></div><div className="operation-cardinality"><strong>{compact(node.rows)} <span>/ {compact(node.plannedRows)}</span></strong><small>{drift(node.estimateRatio)} drift</small></div><div className="operation-loops"><strong>{compact(node.loops)}</strong><small>{compact(node.rows * Math.max(1, node.loops))} total rows</small></div><div className="operation-time"><strong>{ms(node.totalTime)}</strong><small>self {ms(node.selfTime)} · {node.timeShare.toFixed(1)}%</small><i /></div><div className="operation-io"><strong>{compact(node.sharedReads)} <span>/ {compact(node.tempBlocks)}</span></strong><small>shared / temp</small></div></div>; })}{visible.length === 0 && <div className="viewer-empty">No operations match this filter.</div>}</div>
      </div>
      {selected && signal && <aside className={`enterprise-inspector signal-${signal.level}`} aria-label="Selected operation inspector"><div className="inspector-breadcrumb">{crumbs.map((node, index) => <button key={node.path} onClick={() => setSelectedPath(node.path)}>{index > 0 && <span>›</span>}{node.nodeType}</button>)}</div><div className="inspector-status"><i>{signal.symbol}</i><span><small>{signal.label}</small><strong>{signal.reason}</strong></span></div><div className="inspector-title"><div className="section-kicker">Operation {selected.path}</div><h3>{selected.nodeType}</h3><p>{selected.relation}</p></div><section><h4>Operator interpretation</h4><p>{operatorExplanation(selected)}</p></section><section><h4>Cardinality</h4><dl><div><dt>Actual rows / loop</dt><dd>{selected.rows.toLocaleString()}</dd></div><div><dt>Estimated rows</dt><dd>{selected.plannedRows.toLocaleString()}</dd></div><div><dt>Estimate drift</dt><dd>{drift(selected.estimateRatio)}</dd></div><div><dt>Actual loops</dt><dd>{selected.loops.toLocaleString()}</dd></div></dl></section><section><h4>Runtime and I/O</h4><dl><div><dt>Inclusive time</dt><dd>{ms(selected.totalTime)}</dd></div><div><dt>Approx. self time</dt><dd>{ms(selected.selfTime)}</dd></div><div><dt>Shared reads</dt><dd>{selected.sharedReads.toLocaleString()}</dd></div><div><dt>Temporary blocks</dt><dd>{selected.tempBlocks.toLocaleString()}</dd></div></dl></section><section><h4>Predicate evidence</h4><code>{selected.predicate || "No predicate was captured for this operation."}</code></section><section className="inspector-caution"><h4>DBA boundary</h4><p>The plan shows measured execution behavior. Confirm schema, indexes, statistics freshness, data distribution and bind-value frequency before choosing a production change.</p></section></aside>}
    </div>
  </section>;
}
