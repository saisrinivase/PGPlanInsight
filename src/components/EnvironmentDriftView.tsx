import { useMemo, useState } from "react";
import { databaseContextExample, inspectDatabaseContext, type DatabaseContext } from "../database-context.ts";
import { compareDatabaseEnvironments } from "../environment-drift.ts";

export function EnvironmentDriftView({ target }: { target: DatabaseContext | null }) {
  const [source, setSource] = useState("");
  const [reference, setReference] = useState<DatabaseContext | null>(null);
  const [error, setError] = useState("");
  const report = useMemo(() => reference && target ? compareDatabaseEnvironments(reference, target) : null, [reference, target]);
  const compare = () => {
    try { setReference(inspectDatabaseContext(source).context); setError(""); }
    catch (caught) { setReference(null); setError(caught instanceof Error ? caught.message : "Reference context could not be inspected."); }
  };
  return <section className="environment-drift" aria-labelledby="environment-drift-title">
    <header><div><span>Stage 5 · environment drift</span><h3 id="environment-drift-title">Compare PTEST with production</h3><p>Import PTEST as the reference. The Context Pack already applied above is treated as the production target.</p></div><aside><strong>Evidence boundary</strong><span>Metadata differences are observed. Performance impact remains a hypothesis until a comparable plan verifies it.</span></aside></header>
    {!target && <div className="drift-empty"><strong>Apply the production Context Pack first</strong><span>The comparison never connects to either database and stores no credentials, SQL text, host, or data values.</span></div>}
    {target && <><label htmlFor="reference-context-input">PTEST reference Context Pack <span>Sanitized JSON · 1 MB maximum</span></label><textarea id="reference-context-input" aria-label="PTEST reference context" value={source} onChange={(event) => { setSource(event.target.value); setReference(null); setError(""); }} placeholder="Paste the sanitized PTEST Context Pack"/><div className="drift-actions"><button onClick={() => { setSource(databaseContextExample); setReference(null); setError(""); }}>Load reference example</button><button className="primary" disabled={!source.trim()} onClick={compare}>Compare environments</button></div>{error && <p className="form-error" role="alert">{error}</p>}</>}
    {report && <section className="drift-report" aria-label="Environment drift report"><div className="drift-summary"><div><span>Compared</span><strong>{report.comparedRelations} relations</strong></div><div className="critical"><span>Critical</span><strong>{report.counts.critical}</strong></div><div className="warning"><span>Review</span><strong>{report.counts.warning}</strong></div><div><span>Informational</span><strong>{report.counts.info}</strong></div><p>{report.conclusion}</p></div>{report.differences.length > 0 ? <div className="drift-list">{report.differences.map((item) => <article className={`drift-${item.severity}`} key={item.id}><header><span>{item.area.replaceAll("-", " ")}</span><strong>{item.object}</strong><em>{item.severity}</em></header><dl><div><dt>PTEST</dt><dd>{item.referenceValue}</dd></div><div><dt>Production</dt><dd>{item.targetValue}</dd></div></dl><div className="drift-explanation"><p><b>Observed</b>{item.observed}</p><p><b>Possible impact</b>{item.hypothesis}</p><p><b>Validate next</b>{item.nextAction}</p></div></article>)}</div> : <div className="drift-match"><strong>No captured metadata drift found</strong><span>{report.conclusion}</span></div>}</section>}
  </section>;
}
