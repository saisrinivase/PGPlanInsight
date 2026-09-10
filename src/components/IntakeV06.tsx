import { type DragEvent, type FormEvent, useRef, useState } from "react";
import type { StoredCase } from "../case-store.ts";

interface Props { onAnalyze: (source: string, title: string) => void; busy: boolean; error: string; history: StoredCase[]; onOpenCase: (item: StoredCase) => void; onClearHistory: () => void }

export function IntakeV06({ onAnalyze, busy, error, history, onOpenCase, onClearHistory }: Props) {
  const [source, setSource] = useState(""), [title, setTitle] = useState(""), [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null), historyRef = useRef<HTMLElement>(null);
  const submit = (event: FormEvent) => { event.preventDefault(); onAnalyze(source, title); };
  const readFile = async (file?: File) => { if (!file || file.size > 10_000_000) return; setSource(await file.text()); if (!title) setTitle(file.name.replace(/\.(json|txt)$/i, "")); };
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]); };
  const sample = async () => { const response = await fetch("/samples/memory_spill_plan.json"); onAnalyze(await response.text(), "Live sample · sort spill"); };
  return <section className="intake-console">
    <aside className="intake-rail" aria-label="Analysis workspace navigation">
      <div className="rail-section"><span>Workspace</span><button className="active"><i>＋</i>New analysis</button><button onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth" })}><i>◷</i>Plan history <b>{history.length}</b></button><a href="https://www.postgresql.org/docs/current/using-explain.html" target="_blank" rel="noreferrer"><i>?</i>Capture documentation</a></div>
      <div className="rail-section"><span>Local analysis</span><div className="rail-fact"><i />No database connection</div><div className="rail-fact"><i />Nothing transmitted</div><div className="rail-fact"><i />History on this device</div></div>
      <div className="rail-footer"><strong>PGPlan Insight</strong><span>Browser-local diagnostics</span></div>
    </aside>

    <div className="intake-operations">
      <header className="operations-heading"><div><div className="section-kicker">PostgreSQL plan diagnostics</div><h1>Diagnose the plan. Verify the change.</h1><p>Analyze pasted EXPLAIN evidence locally. No database credentials or server connection required.</p></div><button type="button" onClick={sample} disabled={busy}>Load sample plan</button></header>
      <form className={`evidence-editor ${dragging ? "dragging" : ""}`} onSubmit={submit} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <div className="editor-toolbar"><div><span>Execution plan input</span><strong>TEXT or FORMAT JSON</strong></div><div><button type="button" onClick={() => { setSource(""); setTitle(""); }}>Clear</button><button type="button" onClick={() => fileRef.current?.click()}>Choose file</button><input ref={fileRef} className="file-input" type="file" accept=".json,.txt,application/json,text/plain" onChange={(event) => void readFile(event.target.files?.[0])} /></div></div>
        <div className="editor-case"><label htmlFor="case-title-v06">Case name <span>Optional</span></label><input id="case-title-v06" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Monthly report before index review" /></div>
        <label className="plan-evidence-label" htmlFor="plan-input-v06">Plan evidence <span>10 MB maximum</span></label>
        <div className="editor-input"><div className="editor-gutter" aria-hidden="true">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8</div><textarea id="plan-input-v06" required spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} placeholder={`Paste PostgreSQL EXPLAIN output here…\n\nRecommended capture:\nEXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)`} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="editor-drop"><span>⇧</span><div><strong>Paste above or drop a plan file here</strong><small>Analysis runs entirely in this browser.</small></div></div>
        <div className="editor-actions"><div><span>Input format</span><strong>Auto-detect</strong></div><p>ANALYZE executes the statement when capturing a plan. Use production-safe judgment.</p><button type="submit" disabled={busy || !source.trim()}>{busy ? "Analyzing…" : <>Analyze plan <span>›</span></>}</button></div>
      </form>

      {history.length > 0 && <section className="console-history" ref={historyRef}><header><div><span>Local case history</span><strong>Recent plans</strong></div><button onClick={onClearHistory}>Clear all history</button></header><div className="history-table"><div className="history-table-head"><span>Case</span><span>Captured</span><span>Runtime</span><span>Diagnosis</span><span>Evidence</span></div>{history.slice(0, 8).map((item) => <button key={item.id} onClick={() => onOpenCase(item)}><span><strong>{item.title}</strong><small>{item.analysis.format} · {item.analysis.nodeCount} nodes</small></span><span>{new Date(item.createdAt).toLocaleString()}</span><span>{item.analysis.executionTime == null ? "N/A" : `${item.analysis.executionTime.toLocaleString()} ms`}</span><span>{item.analysis.primarySignal}</span><span>{item.analysis.score}/100 ›</span></button>)}</div></section>}
    </div>

  </section>;
}
