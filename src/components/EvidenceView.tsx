import type { Analysis } from "../types.ts";

export function CapturedEvidence({ result }: { result: Analysis }) {
  return <section className="recommendation-section captured-evidence" aria-labelledby="captured-evidence-title"><header><div><span>03</span><strong id="captured-evidence-title">Captured evidence</strong></div><small>{result.score}/100 · {result.evidenceLevel}</small></header><div className="captured-evidence-grid">{result.checks.map((item) => <div key={item.label}><span className={`check ${item.present ? "yes" : "no"}`}>{item.present ? "Present" : "Missing"}</span><strong>{item.label}</strong><p>{item.value}</p></div>)}</div>{result.settings.length > 0 && <details className="captured-settings"><summary>Captured planner settings ({result.settings.length})</summary><div>{result.settings.map((setting) => <p key={setting.name}><code>{setting.name}</code><span>{setting.value}</span></p>)}</div></details>}</section>;
}

export function EvidenceView({ result }: { result: Analysis }) {
  return <section className="workspace-panel recommendations-workbench"><div className="section-kicker">Capture fitness</div><h2>Captured evidence</h2><p className="lede">Fields present in the pasted plan determine which diagnostic claims are defensible.</p><CapturedEvidence result={result} /></section>;
}
