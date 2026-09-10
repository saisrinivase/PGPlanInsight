import type { Analysis } from "../types.ts";

const ms = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`;

export function PlanMap({ result }: { result: Analysis }) {
  const maxTime = Math.max(1, ...result.planMap.map((node) => node.totalTime));
  return <section className="workspace-panel"><div className="section-kicker">Execution shape</div><h2>Plan map</h2><p className="lede">Parent timing includes child work; self time is an approximation. Flags always map to deterministic thresholds.</p><div className="map-legend"><span><i className="legend-time" />Inclusive time</span><span><b>spill</b> Temporary I/O</span><span><b>estimate</b> ≥10× row drift</span><span><b>loops</b> Repeated ≥500×</span></div><div className="plan-map">{result.planMap.map((node) => <article className="map-row" style={{ "--depth": node.depth } as React.CSSProperties} key={node.path}><div className="node-path">{node.path}</div><div className="node-name"><span>{node.nodeType}</span><small>{node.relation}</small></div><div className="time-track" aria-label={`${node.timeShare.toFixed(1)} percent of execution time`}><i style={{ width: `${Math.max(1.5, node.totalTime / maxTime * 100)}%` }} /></div><div className="node-time"><strong>{ms(node.totalTime)}</strong><small>self {ms(node.selfTime)}</small></div><div className="node-flags">{node.flags.length ? node.flags.map((flag) => <span className={`flag ${flag}`} key={flag}>{flag}</span>) : <span className="quiet">clear</span>}</div></article>)}</div></section>;
}
