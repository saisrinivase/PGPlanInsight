import { Fragment, useEffect, useMemo, useState } from "react";
import type { PlanVisualNode } from "../types.ts";
import { nodeSignal } from "../node-signal.ts";
import { indexCandidate } from "../index-candidate.ts";
import { rootCauseTrace } from "../root-cause-trace.ts";
import { coercionEvidence } from "../type-coercion.ts";

const format = (value: number, digits = 0) => value.toLocaleString(undefined, { maximumFractionDigits: digits });
const statusLabel = (level: ReturnType<typeof nodeSignal>["level"]) => level === "critical" ? "Issue" : level === "review" ? "Review" : level === "healthy" ? "Good" : "Info";
const statusSymbol = (level: ReturnType<typeof nodeSignal>["level"]) => level === "critical" ? "!" : level === "review" ? "▲" : level === "healthy" ? "✓" : "i";

export function PlanGraphV2({ nodes, selected, onSelect, revealRequest }: { nodes: PlanVisualNode[]; selected?: string; onSelect: (node: PlanVisualNode) => void; intensity: (node: PlanVisualNode) => number; revealRequest?: { path: string; request: number } | null }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  useEffect(() => { if (revealRequest) setExpandedPath(revealRequest.path); }, [revealRequest]);
  const parentPaths = useMemo(() => new Set(nodes.flatMap((node) => {
    const parts = node.path.split(".");
    return parts.length > 1 ? [parts.slice(0, -1).join(".")] : [];
  })), [nodes]);
  const nodeOrdinal = useMemo(() => new Map(nodes.map((node, index) => [node.path, index + 1])), [nodes]);
  const maxTime = useMemo(() => Math.max(0, ...nodes.map((node) => node.totalTime)), [nodes]);
  const maxReads = useMemo(() => Math.max(0, ...nodes.map((node) => node.sharedReads)), [nodes]);
  const visible = nodes.filter((node) => ![...collapsed].some((path) => node.path.startsWith(`${path}.`)) && (!filter.trim() || `${node.nodeType} ${node.relation} ${node.predicate}`.toLowerCase().includes(filter.trim().toLowerCase())));
  const toggle = (path: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path); else next.add(path);
    return next;
  });

  return <section className="plan-tree-table" aria-label="Graphical execution plan">
    <header className="plan-table-toolbar">
      <div className="plan-table-title"><strong>Execution plan overview</strong><span>{nodes.length} nodes</span></div>
      <label className="node-filter"><span className="sr-only">Filter plan nodes</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter nodes…" /><b aria-hidden="true">⌕</b></label>
      {collapsed.size > 0 && <button className="expand-all" onClick={() => setCollapsed(new Set())}>Restore all nodes</button>}
    </header>
    <div className="plan-table-scroll">
      <div className="plan-table-head" role="row"><span className="head-slno">SL No.</span><span className="head-node">Node</span><span className="head-time">Actual time (ms)</span><span className="head-rows">Rows</span><span className="head-loops">Loops</span><span className="head-storage">Storage evidence</span><span className="head-reads">Shared reads</span><span className="head-temp">Temp blocks</span><span className="head-estimate">Estimate</span><span className="head-status">Status</span></div>
      <div role="tree" aria-label="Execution operation tree">{visible.map((node) => {
        const signal = nodeSignal(node), hasChildren = parentPaths.has(node.path), isCollapsed = collapsed.has(node.path), status = statusLabel(signal.level), isSelected = selected === node.path, isExpanded = expandedPath === node.path;
        const candidate = indexCandidate(node), trace = rootCauseTrace(nodes, node), coercions = coercionEvidence(node.expressions ?? []);
        return <Fragment key={node.path}>
          <div className={`plan-table-row signal-${signal.level} ${isSelected ? "selected" : ""}`} role="treeitem" aria-level={node.depth + 1} aria-expanded={hasChildren ? !isCollapsed : undefined} aria-selected={isSelected} data-plan-depth={node.depth} style={{ "--depth": Math.min(node.depth, 6) } as React.CSSProperties}>
            <span className="numeric node-serial">{nodeOrdinal.get(node.path)}</span><div className="plan-node-cell"><span className="tree-guides" aria-hidden="true" />{hasChildren ? <button className="row-collapse" aria-label={`${isCollapsed ? "Expand" : "Collapse"} subtree at ${node.nodeType}`} onClick={() => toggle(node.path)}>{isCollapsed ? "›" : "⌄"}</button> : <span className="row-leaf" />}<span className={`row-status-icon ${signal.level}`} aria-hidden="true">{statusSymbol(signal.level)}</span><button className="row-node-name" onClick={() => { onSelect(node); setExpandedPath(node.path); }} aria-label={`${node.nodeType}, ${signal.label}: ${signal.reason}`}><strong>{node.nodeType}</strong>{node.relation !== "—" && <small>on {node.relation}</small>}</button><button className="node-info-button" aria-label={`${isExpanded ? "Hide" : "Show"} details for ${node.nodeType} ${node.path}`} aria-expanded={isExpanded} aria-controls={`node-detail-${node.path.replaceAll(".", "-")}`} onClick={() => { onSelect(node); setExpandedPath((current) => current === node.path ? null : node.path); }}>i</button>{isCollapsed && <em>+{nodes.filter((item) => item.path.startsWith(`${node.path}.`)).length}</em>}</div>
            <span className="numeric metric-number time-metric" style={{ "--metric-share": `${maxTime > 0 ? Math.max(2, node.totalTime / maxTime * 100) : 0}%` } as React.CSSProperties}><i aria-hidden="true" /><b>{format(node.totalTime, 3)}</b></span><span className="numeric">{format(node.rows)}</span><span className="numeric">{format(node.loops)}</span><span className="numeric metric-number read-metric" style={{ "--metric-share": `${maxReads > 0 ? Math.max(2, node.sharedReads / maxReads * 100) : 0}%` } as React.CSSProperties}><i aria-hidden="true" /><b>{format(node.sharedReads)}</b></span><span className="numeric">{format(node.tempBlocks)}</span><span className="numeric">{node.estimateRatio == null ? "—" : `${format(node.estimateRatio, 1)}×`}</span><span className={`row-status ${signal.level}`} title={signal.reason}>{status}</span>
          </div>
          {isExpanded && <div className={`inline-node-detail signal-${signal.level}`} id={`node-detail-${node.path.replaceAll(".", "-")}`} role="region" aria-label={`Selected node details for ${node.nodeType}`}>
            <div className="inline-diagnosis"><span>Why this status · {signal.label}</span><strong>{signal.reason}</strong><p>{signal.level === "healthy" ? "No node-level threshold was crossed. Review the causal trace only when parent time is inherited from a child." : "This classifies captured evidence; validate the suspected cause before changing production."}</p></div>
            <dl><div><dt>Inclusive / self</dt><dd>{format(node.totalTime, 3)} / {format(node.selfTime, 3)} ms</dd></div><div><dt>Actual / planned rows</dt><dd>{format(node.rows)} / {format(node.plannedRows)}</dd></div><div><dt>Loops / total rows</dt><dd>{format(node.loops)} / {format(node.rows * Math.max(1, node.loops))}</dd></div><div><dt>Shared reads / temp</dt><dd>{format(node.sharedReads)} / {format(node.tempBlocks)}</dd></div></dl>
            {trace && <div className={`inline-causal-trace trace-${trace.kind}`}><div><span>Causal trace · {trace.confidence} confidence</span><strong>{trace.chain.map((item) => item.nodeType).join(" → ")}</strong></div><dl><div><dt>Observed at</dt><dd>{node.nodeType} · node {node.path}</dd></div><div><dt>Investigate first</dt><dd>{trace.origin.nodeType} · node {trace.origin.path}</dd></div></dl><p>{trace.summary}</p><small>{trace.boundary}</small></div>}
            <div className="inline-predicate"><span>Predicate evidence</span><code>{node.predicate || "No predicate captured for this operation."}</code></div>
            {coercions.length > 0 && <div className="inline-knowledge-pattern" aria-label="Type coercion knowledge guidance"><header><span>Known pattern · TYPE-001</span><strong>Plan-visible type coercion</strong><b>{coercions.some((item) => item.context === "predicate") ? "Review" : "Information"}</b></header><p><strong>Proven:</strong> PostgreSQL captured {coercions.length === 1 ? "a cast" : `${coercions.length} casts`} at this operation.</p><code>{coercions.map((item) => `${item.source}: ${item.expression}`).join("\n")}</code><dl><div><dt>Potential effect</dt><dd>Per-row conversion, precision change, or failure to match an ordinary index expression.</dd></div><div><dt>Not yet proven</dt><dd>The cast caused material runtime or originated in a UNION, view, parameter, or environment drift.</dd></div><div><dt>Collect next</dt><dd>SQL, branch output types, view definition, parameter types, and index definitions.</dd></div><div><dt>Validation</dt><dd>Remove the unintended cast and compare the same workload using Fix Validation.</dd></div></dl></div>}
            {candidate ? <div className="inline-index"><span>Candidate index to validate</span><code>{candidate.sql}</code><p>{candidate.qualification}</p></div> : /seq scan/i.test(node.nodeType) && node.predicate ? <div className="inline-index withheld"><span>Index candidate withheld</span><p>The predicate does not expose a safe plain-column candidate. Inspect expression or partial-index options and the PostgreSQL catalog.</p></div> : null}
          </div>}
        </Fragment>;
      })}</div>
      {!visible.length && <p className="no-plan-matches">No plan nodes match this filter.</p>}
    </div>
  </section>;
}
