import type { Analysis } from "../types.ts";

const metric = (value: number | null) => value == null ? "N/A" : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`;

export function SummaryView({ result }: { result: Analysis }) {
  return <section className="workspace-panel" aria-labelledby="signal-title"><div className="section-kicker">Primary bottleneck signal</div><div className="signal-line"><h2 id="signal-title">{result.primarySignal}</h2><span className="score">Evidence {result.score}/100 · {result.evidenceLevel}</span></div><p className="lede">{result.headline}</p><div className="metrics" aria-label="Plan metrics"><div><span>Execution</span><strong>{metric(result.executionTime)}</strong></div><div><span>Planning</span><strong>{metric(result.planningTime)}</strong></div><div><span>Plan nodes</span><strong>{result.nodeCount}</strong></div><div><span>Format</span><strong>{result.format}</strong></div></div><div className="findings"><div className="section-kicker">Ranked findings</div>{result.findings.map((finding) => <article className={`finding ${finding.severity}`} key={finding.id}><div className="finding-id">{finding.id}</div><div><h3>{finding.title}</h3><p>{finding.detail}</p><dl><div><dt>Evidence</dt><dd>{finding.evidence}</dd></div><div><dt>Test next</dt><dd>{finding.nextAction}</dd></div></dl></div></article>)}</div></section>;
}
