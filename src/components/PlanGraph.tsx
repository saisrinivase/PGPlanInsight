import type { PlanVisualNode } from "../types.ts";

interface GraphNode { value: PlanVisualNode; children: GraphNode[] }

function graph(nodes: PlanVisualNode[]): GraphNode | null {
  const byPath = new Map(nodes.map((node) => [node.path, { value: node, children: [] } as GraphNode]));
  let root: GraphNode | null = null;
  for (const item of byPath.values()) {
    const parentPath = item.value.path.split(".").slice(0, -1).join(".");
    const parent = byPath.get(parentPath);
    if (parent) parent.children.push(item); else root = item;
  }
  return root;
}

function Branch({ item, selected, onSelect, intensity }: { item: GraphNode; selected: string | undefined; onSelect: (node: PlanVisualNode) => void; intensity: (node: PlanVisualNode) => number }) {
  const node = item.value;
  const totalRows = node.rows * Math.max(1, node.loops);
  return <div className="graph-branch" style={{ "--flow": Math.min(6, Math.max(1, 1 + Math.log10(totalRows + 1))) } as React.CSSProperties}>
    <button className={`graph-node ${selected === node.path ? "selected" : ""} ${node.flags.length ? "risk" : ""}`} style={{ "--heat": intensity(node) } as React.CSSProperties} onClick={() => onSelect(node)}>
      <span className="graph-node-type">{node.nodeType}</span>
      <strong>{node.relation}</strong>
      <span>{node.totalTime.toLocaleString(undefined, { maximumFractionDigits: 1 })} ms · {totalRows.toLocaleString(undefined, { maximumFractionDigits: 0 })} total rows</span>
      <small>{node.rows.toLocaleString(undefined, { maximumFractionDigits: 0 })}/loop × {node.loops.toLocaleString()} · {node.sharedReads.toLocaleString()} reads</small>
      <i />
      {node.flags.length > 0 && <em>{node.flags.join(" · ")}</em>}
    </button>
    {item.children.length > 0 && <div className="graph-children">{item.children.map((child) => <Branch key={child.value.path} item={child} selected={selected} onSelect={onSelect} intensity={intensity} />)}</div>}
  </div>;
}

export function PlanGraph({ nodes, selected, onSelect, intensity }: { nodes: PlanVisualNode[]; selected?: string; onSelect: (node: PlanVisualNode) => void; intensity: (node: PlanVisualNode) => number }) {
  const root = graph(nodes);
  return <div className="plan-graph" aria-label="Graphical execution plan">{root && <Branch item={root} selected={selected} onSelect={onSelect} intensity={intensity} />}</div>;
}
