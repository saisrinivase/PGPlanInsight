import type { DatabaseContext } from "../database-context.ts";
import { candidateIndexExperiment } from "../index-experiment.ts";
import type { Analysis } from "../types.ts";

export function CandidateIndexExperiments({ result, context }: { result: Analysis; context: DatabaseContext | null }) {
  const experiments = result.planMap.flatMap((node) => { const experiment = candidateIndexExperiment(node, context); return experiment ? [{ node, experiment }] : []; });
  if (!experiments.length) return null;
  return <section className="candidate-experiment-workbench" aria-label="Controlled candidate index experiments">
    <header><div><span>Controlled candidate experiments</span><h2>Candidate index shapes</h2><p>Planning hypotheses only. Nothing is executed, and no physical index is created by this browser.</p></div><strong>{experiments.length} candidate{experiments.length === 1 ? "" : "s"}</strong></header>
    <div className="candidate-experiment-list">{experiments.map(({ node, experiment }, index) => <details key={`${node.path}-${experiment.candidateShape}`} open={index === 0}><summary><span>{String(index + 1).padStart(2, "0")}</span><span><small>{experiment.status.replaceAll("-", " ")} · {experiment.confidence} confidence</small><strong>{experiment.candidateShape}</strong><em>Operation {node.rank} · {node.nodeType} · {node.sharedReads.toLocaleString()} reads · {node.timeShare.toFixed(1)}% inclusive time</em></span><b>Review experiment</b></summary><div className="candidate-experiment-body">
      <dl className="candidate-experiment-evidence"><div><dt>Predicate evidence</dt><dd><code>{experiment.candidate.predicateEvidence}</code></dd></div><div><dt>Key/order rationale</dt><dd>{experiment.candidate.keyRationale}</dd></div><div><dt>Overlap qualification</dt><dd>{experiment.overlap}</dd></div></dl>
      <div className="candidate-experiment-guardrails"><section><h4>Unknown prerequisites</h4><ul>{experiment.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>Write and storage risks</h4><ul>{experiment.risks.map((item) => <li key={item}>{item}</li>)}</ul></section><section><h4>Before testing</h4><ul>{experiment.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></section></div>
      <section className="hypopg-experiment"><header><div><small>Optional planning-only validation</small><h4>HypoPG experiment</h4></div><span>Extension availability unknown</span></header><code>{experiment.hypopg.create}</code><p>{experiment.hypopg.inspect}</p><code>{experiment.hypopg.rollback}</code></section>
      <div className="candidate-experiment-gates"><section><h4>Success gates</h4><ol>{experiment.successCriteria.map((item) => <li key={item}>{item}</li>)}</ol></section><section><h4>Rollback boundary</h4><p>{experiment.rollback}</p></section></div></div>
    </details>)}</div>
  </section>;
}
