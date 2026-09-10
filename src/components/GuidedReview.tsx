import type { Analysis, Finding, PlanVisualNode } from "../types.ts";

const docs = {
  explain: "https://www.postgresql.org/docs/current/using-explain.html",
  explainCommand: "https://www.postgresql.org/docs/current/sql-explain.html",
  statistics: "https://www.postgresql.org/docs/current/planner-stats.html",
  analyze: "https://www.postgresql.org/docs/current/sql-analyze.html",
  indexes: "https://www.postgresql.org/docs/current/indexes.html",
  memory: "https://www.postgresql.org/docs/current/runtime-config-resource.html",
  parallel: "https://www.postgresql.org/docs/current/parallel-query.html",
} as const;

function Reference({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children}<span aria-hidden="true"> ↗</span></a>;
}

function contextualReference(finding: Finding | undefined) {
  if (finding?.id.startsWith("MEM")) return { href: docs.memory, label: "Resource consumption and work_mem" };
  if (finding?.id.startsWith("EST")) return { href: docs.statistics, label: "Planner statistics and extended statistics" };
  if (finding?.id.startsWith("PATH")) return { href: docs.indexes, label: "PostgreSQL index guidance" };
  if (finding?.id.startsWith("PAR")) return { href: docs.parallel, label: "How parallel query works" };
  return { href: docs.explain, label: "Using EXPLAIN" };
}

export function GuidedReview({ result, culprit, onFocus, onValidate }: { result: Analysis; culprit: PlanVisualNode | null; onFocus: () => void; onValidate: () => void }) {
  const primary = result.findings[0];
  const contextual = contextualReference(primary);
  const hasActual = result.executionTime != null && result.planMap.some((node) => node.loops > 0);
  const hasBuffers = result.metrics.rootSharedHits + result.metrics.rootSharedReads + result.metrics.rootTempBlocks > 0;
  return <section className="guided-review" aria-labelledby="guided-review-title">
    <header><div><div className="section-kicker">Guided DBA review</div><h2 id="guided-review-title">From plan evidence to a verified change</h2><p>Follow the steps in order. Measured facts stay separate from hypotheses, and no change is treated as proven until an after plan confirms it.</p></div><span>{hasActual && hasBuffers ? "Capture ready" : "Capture incomplete"}</span></header>
    <ol>
      <li><details open><summary><b>1</b><span><strong>Validate the evidence</strong><small>Confirm what PostgreSQL actually measured</small></span></summary><div><p>{hasActual ? `Runtime evidence is present: ${result.executionTime?.toLocaleString()} ms across ${result.nodeCount} nodes.` : "Actual runtime or loop evidence is missing. Do not diagnose runtime from estimated cost alone."} {hasBuffers ? "Buffer evidence is present." : "Buffer evidence is missing, so cache and physical-read conclusions are limited."}</p><code>EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)</code><p className="safety-note"><strong>Safety:</strong> ANALYZE executes the statement. Use a representative, production-safe environment; wrap eligible data-changing statements in a transaction that you roll back.</p><div className="guide-links"><Reference href={docs.explainCommand}>EXPLAIN options and safety</Reference><Reference href={docs.explain}>How to read EXPLAIN</Reference></div></div></details></li>
      <li><details open><summary><b>2</b><span><strong>Locate the dominant measured work</strong><small>Start with the implicated branch, not the root label</small></span></summary><div><p>{culprit ? `The current evidence points first to node ${culprit.path}: ${culprit.nodeType}${culprit.relation !== "—" ? ` on ${culprit.relation}` : ""}. It recorded ${culprit.totalTime.toLocaleString()} ms inclusive time, ${culprit.loops.toLocaleString()} loops, and ${culprit.rows.toLocaleString()} rows.` : "No single node crossed a deterministic threshold. Review the hottest branch and evidence completeness."}</p><p>Parent timing includes child work. Compare inclusive time, approximate self time, loops, rows, reads and temporary blocks together.</p>{culprit && <button onClick={onFocus}>Focus this node in the tree</button>}</div></details></li>
      <li><details><summary><b>3</b><span><strong>Interpret the mechanism</strong><small>Understand why the work occurred</small></span></summary><div><p><strong>{primary?.title ?? result.primarySignal}.</strong> {primary?.detail ?? result.headline}</p><p>Measured support: {primary?.evidence ?? "No dominant evidence rule fired."}</p><div className="guide-links"><Reference href={contextual.href}>{contextual.label}</Reference></div></div></details></li>
      <li><details><summary><b>4</b><span><strong>Confirm what the plan cannot know</strong><small>Check catalog and workload context before changing production</small></span></summary><div><ul><li>Confirm existing indexes, column order, predicates, validity and actual usage.</li><li>Check statistics freshness, estimate drift, data skew and correlated predicates.</li><li>Confirm parameter values, concurrency and whether this bind value is representative.</li><li>Check table churn and visibility-map health before interpreting index-only heap fetches.</li></ul><div className="guide-links"><Reference href={docs.statistics}>Planner statistics</Reference><Reference href={docs.analyze}>ANALYZE and statistics collection</Reference><Reference href={docs.indexes}>Indexes</Reference></div></div></details></li>
      <li><details><summary><b>5</b><span><strong>Run one controlled experiment</strong><small>Change one variable and preserve a clean comparison</small></span></summary><div><p>{primary?.nextAction ?? "Test one query, index, statistics, or session-level change at a time."}</p><p>Do not apply a global memory or planner setting based on one plan. For memory findings, account for every concurrent sort/hash operation and active session.</p><div className="guide-links"><Reference href={docs.memory}>Memory resource settings</Reference></div></div></details></li>
      <li><details><summary><b>6</b><span><strong>Prove the result</strong><small>Compare the same workload before accepting the fix</small></span></summary><div><p>Capture an after plan with the same parameters and comparable cache/load conditions. Verify runtime, rows, loops, buffers, temporary I/O and plan shape—not runtime alone.</p><button onClick={onValidate}>Open Fix Validation</button></div></details></li>
    </ol>
  </section>;
}
