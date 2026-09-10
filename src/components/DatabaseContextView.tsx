import { useState } from "react";
import { databaseContextExample, inspectDatabaseContext, type ContextImportResult, type DatabaseContext } from "../database-context.ts";

export function DatabaseContextView({ context, onChange }: { context: DatabaseContext | null; onChange: (context: DatabaseContext | null) => void }) {
  const [source, setSource] = useState(context ? JSON.stringify(context, null, 2) : "");
  const [inspection, setInspection] = useState<ContextImportResult | null>(null);
  const [error, setError] = useState("");
  const changeSource = (value: string) => { setSource(value); setInspection(null); setError(""); };
  const preview = () => { try { setInspection(inspectDatabaseContext(source)); setError(""); } catch (caught) { setInspection(null); setError(caught instanceof Error ? caught.message : "Context could not be inspected."); } };
  const apply = () => { if (!inspection) return; onChange(inspection.context); setSource(JSON.stringify(inspection.context, null, 2)); setError(""); };
  return <section className="workspace-panel context-workbench">
    <header className="context-heading">
      <div>
        <div className="section-kicker">Optional evidence · no database connection</div>
        <h2>Database context</h2>
        <p className="lede">Use a sanitized metadata pack only when you want the tool to qualify catalog-based hypotheses. Plan timing and node diagnosis work without it.</p>
      </div>
      <div className={`context-state ${context ? "applied" : "plan-only"}`}>
        <span>{context ? "Context applied" : "Plan-only analysis"}</span>
        <strong>{context ? `${context.relations.length} relation(s) available · PostgreSQL ${context.provenance.postgresVersion}` : "Safe to continue"}</strong>
      </div>
    </header>

    <section className="context-diagnostic-boundary" aria-label="What the plan and context can establish">
      <header><span>Why it helps</span><strong>Separate measured execution evidence from database metadata</strong></header>
      <div className="context-evidence-columns">
        <article><span className="context-evidence-tag proven">Plan proves</span><strong>What happened</strong><p>Actual time, rows, loops, buffers, filters, heap fetches, spills, and estimate drift.</p></article>
        <article><span className="context-evidence-tag qualifies">Context qualifies</span><strong>Why it may have happened</strong><p>Existing indexes, column types, relation size, statistics metadata, partitions, and safe planner settings.</p></article>
        <article><span className="context-evidence-tag unknown">Still requires validation</span><strong>Whether the change is safe</strong><p>Workload recurrence, concurrency, cache effects, result correctness, and production improvement.</p></article>
      </div>
    </section>

    <section className="context-impact" aria-label="Diagnoses improved by database context">
      <strong>Accuracy gained</strong>
      <ul>
        <li><span>Index advice</span>Detect an equivalent or overlapping index before proposing another.</li>
        <li><span>Type coercion</span>Confirm bigint, numeric, text, or expression-type differences visible in metadata.</li>
        <li><span>Estimate drift</span>Qualify statistics, correlation, extended-statistics, and partition hypotheses.</li>
        <li><span>Environment drift</span>Compare sanitized PTEST and production metadata without table data.</li>
      </ul>
    </section>

    <div className="context-boundary">
      <strong>{context ? "Sanitized context is active for this analysis" : "No context imported—catalog conclusions remain hypotheses"}</strong>
      <span>{context ? `Collected ${new Date(context.provenance.collectedAt).toLocaleString()} by ${context.provenance.collector}. Values and unknown fields were not retained.` : "You can continue with plan-only diagnosis and add context later when a finding needs catalog confirmation."}</span>
    </div>

    <section className="context-import-stage" aria-labelledby="context-import-title">
      <header><span>01</span><div><strong id="context-import-title">Import sanitized metadata</strong><small>Generated outside this application using read-only SQL</small></div></header>
      <div className="context-collector"><div><strong>Generate a least-privilege pack</strong><span>Run the supplied read-only SQL in psql, inspect its JSON output, then paste it below. It captures metadata—not table rows, SQL text, credentials, hosts, or statistic values.</span></div><a href="/pgplan-context-pack.sql" target="_blank" rel="noreferrer">Open collection SQL ↗</a></div>
      <label className="context-input-label" htmlFor="database-context-input">Sanitized metadata JSON <span>1 MB maximum</span></label>
      <textarea id="database-context-input" className="context-input" aria-label="Sanitized database context" value={source} onChange={(event) => changeSource(event.target.value)} placeholder="Paste PGPlan Insight Context Pack JSON" />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="context-actions"><button onClick={() => changeSource(databaseContextExample)}>Load format example</button><button onClick={preview} disabled={!source.trim()}>Preview sanitized context</button><button onClick={apply} disabled={!inspection}>Apply to this analysis</button>{context && <button onClick={() => { onChange(null); changeSource(""); }}>Remove context</button>}</div>
    </section>

    {inspection && <section className="context-preview" aria-label="Sanitized context preview"><header><div><span>Ready to apply</span><strong>Context Pack v2</strong></div><small>Source v{inspection.preview.sourceVersion} normalized locally</small></header><div className="context-preview-metrics"><div><strong>{inspection.preview.relationCount}</strong><span>Relations</span></div><div><strong>{inspection.preview.columnCount}</strong><span>Columns</span></div><div><strong>{inspection.preview.indexCount}</strong><span>Indexes</span></div><div><strong>{inspection.preview.extendedStatisticCount}</strong><span>Extended stats</span></div><div><strong>{inspection.preview.partitionCount}</strong><span>Partitions</span></div><div><strong>{inspection.preview.settingsCount}</strong><span>Safe settings</span></div></div><dl><div><dt>Captured sections</dt><dd>{inspection.preview.capturedSections.join(", ") || "None declared"}</dd></div><div><dt>Unavailable sections</dt><dd>{inspection.preview.unavailableSections.join(", ") || "None declared"}</dd></div><div><dt>Discarded fields</dt><dd>{inspection.preview.discardedFields.join(", ") || "None"}</dd></div></dl>{inspection.preview.warnings.length > 0 && <div className="context-warnings"><strong>Review before applying</strong>{inspection.preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}</section>}

    <details className="context-privacy"><summary>Accepted evidence and privacy boundary</summary><p>Version 2 retains relation/table statistics, column types and non-value selectivity summaries, index metadata, extended-statistics definitions, partition metadata, and an allowlist of planner settings. Unknown fields, credentials, SQL text, host details, most-common values, and histogram values are never added to the normalized context.</p></details>
  </section>;
}
