import { redactPlanForSharing } from "../redact-plan.ts";
import { type ClipboardEvent, type DragEvent, type FormEvent, useRef, useState } from "react";
import type { StoredCase } from "../case-store.ts";

interface Props { onAnalyze: (source: string, title: string, retentionDays?: number) => void; busy: boolean; error: string; history: StoredCase[]; onOpenCase: (item: StoredCase) => void; onClearHistory: () => void; onDeleteCase: (id: string) => void }

export function IntakeV06({ onAnalyze, busy, error, history, onOpenCase, onClearHistory, onDeleteCase }: Props) {
  const [source, setSource] = useState(""), [title, setTitle] = useState(""), [dragging, setDragging] = useState(false);
  const [redactedPreview, setRedactedPreview] = useState("");
  const [retentionDays, setRetentionDays] = useState(0), [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null), historyRef = useRef<HTMLElement>(null);
  const submit = (event: FormEvent) => { event.preventDefault(); onAnalyze(source, title, retentionDays); };
  const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (text.length < 100_000) return;
    event.preventDefault();
    const input = event.currentTarget;
    const next = source.slice(0, input.selectionStart) + text + source.slice(input.selectionEnd);
    if (new TextEncoder().encode(next).byteLength > 10_000_000) {
      setFileError("Pasted plan exceeds the 10 MB limit. Choose a smaller plan.");
      return;
    }
    const cursor = input.selectionStart + text.length;
    setFileError("");
    setSource(next);
    requestAnimationFrame(() => input.setSelectionRange(cursor, cursor));
  };
  const readFile = async (file?: File) => { if (!file) return; setFileError(""); if (file.size > 10_000_000) { setFileError("File exceeds the 10 MB limit. Choose a smaller plan."); return; } try { setSource(await file.text()); if (!title) setTitle(file.name.replace(/\.(json|txt)$/i, "")); } catch { setFileError("This file could not be read. Try another file or paste its contents."); } };
  const previewRedaction = () => { try { setRedactedPreview(redactPlanForSharing(source)); setFileError(""); } catch (caught) { setFileError(caught instanceof Error ? caught.message : "Unable to redact this plan."); } };
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]); };
  const sample = async () => { try { const response = await fetch("/samples/memory_spill_plan.json"); if (!response.ok) throw new Error(); onAnalyze(await response.text(), "Live sample · sort spill"); } catch { setFileError("Sample could not be loaded. Please retry."); } };
  return <section className="intake-console">
    <aside className="intake-rail" aria-label="Analysis workspace navigation">
      <div className="rail-section"><span>Workspace</span><button className="active"><i>＋</i>New analysis</button><button onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth" })}><i>◷</i>Plan history <b>{history.length}</b></button><a href="https://www.postgresql.org/docs/current/using-explain.html" target="_blank" rel="noreferrer"><i>?</i>Capture documentation</a></div>
      <div className="rail-section"><span>Local analysis</span><div className="rail-fact"><i />No database connection</div><div className="rail-fact"><i />Nothing transmitted</div><div className="rail-fact"><i />Saving is optional</div></div>
      <div className="rail-footer"><strong>PGPlan Insight</strong><span>Browser-local diagnostics</span></div>
    </aside>

    <div className="intake-operations">
      <header className="operations-heading"><div><div className="section-kicker">PostgreSQL plan diagnostics</div><h1>Diagnose the plan. Verify the change.</h1><p>Analyze pasted EXPLAIN evidence locally. No database credentials or server connection required.</p></div><button type="button" onClick={sample} disabled={busy}>Load sample plan</button></header>
      <form className={`evidence-editor ${dragging ? "dragging" : ""}`} onSubmit={submit} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <div className="editor-toolbar"><div><span>Execution plan input</span><strong>TEXT or FORMAT JSON</strong></div><div><button type="button" onClick={() => { setSource(""); setTitle(""); }}>Clear</button><button type="button" disabled={!source.trim() || busy} onClick={previewRedaction}>Preview redacted plan</button><button type="button" onClick={() => fileRef.current?.click()}>Choose file</button><input ref={fileRef} className="file-input" type="file" accept=".json,.txt,application/json,text/plain" onChange={(event) => void readFile(event.target.files?.[0])} /></div></div>
        <div className="editor-case"><label htmlFor="case-title-v06">Case name <span>Optional</span></label><input id="case-title-v06" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Monthly report before index review" /></div>
        <label className="plan-evidence-label" htmlFor="plan-input-v06">Plan evidence <span>10 MB maximum</span></label>
        <div className="editor-input"><div className="editor-gutter" aria-hidden="true">1<br />2<br />3<br />4<br />5<br />6<br />7<br />8</div><textarea id="plan-input-v06" required spellCheck={false} value={source} onPaste={paste} onChange={(event) => setSource(event.target.value)} placeholder={`Paste PostgreSQL EXPLAIN output here…\n\nRecommended capture:\nEXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)`} /></div>
        {(error || fileError) && <p className="form-error" role="alert">{fileError || error}</p>}
        <div className="editor-case"><label htmlFor="retention">Save this plan</label><select id="retention" value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}><option value={0}>Do not save (default)</option><option value={1}>Save for 1 day</option><option value={7}>Save for 7 days</option><option value={30}>Save for 30 days</option></select><p>Saved plans include raw expressions and remain in this browser profile. Remove sensitive values before saving. Expired cases are deleted when history is opened; at most 50 cases are kept.</p></div>
        {redactedPreview && <section className="redaction-preview" aria-label="Redacted plan preview"><h2>Review before using or sharing</h2><p>Identifiers are replaced. Expressions, SQL, settings and unrecognized fields are removed. Row counts, costs and timings remain and may still be sensitive. Predicate and settings diagnostics will be limited. Review the complete output.</p><label htmlFor="redacted-preview">Redacted JSON</label><textarea id="redacted-preview" readOnly value={redactedPreview} /><div><button type="button" onClick={() => { setSource(redactedPreview); setTitle(""); setRedactedPreview(""); }}>Use redacted plan</button><button type="button" onClick={() => setRedactedPreview("")}>Cancel preview</button></div></section>}
        <div className="editor-drop"><span>⇧</span><div><strong>Paste above or drop a plan file here</strong><small>Analysis runs entirely in this browser.</small></div></div>
        <div className="editor-actions"><div><span>Input format</span><strong>Auto-detect</strong></div><p>EXPLAIN ANALYZE executes SQL, including writes. Use a safe test environment and statement timeout; rollback cannot undo every side effect.</p><button type="submit" disabled={busy || !source.trim()}>{busy ? "Analyzing…" : <>Analyze plan <span>›</span></>}</button></div>
      </form>

      {history.length > 0 && <section className="console-history" ref={historyRef}><header><div><span>Local case history</span><strong>Recent plans</strong></div><button onClick={onClearHistory}>Clear all history</button></header><div className="history-table"><div className="history-table-head"><span>Case</span><span>Captured</span><span>Runtime</span><span>Diagnosis</span><span>Evidence</span></div>{history.map((item) => <div key={item.id} className="history-case"><button onClick={() => onOpenCase(item)}><span><strong>{item.title}</strong><small>{item.analysis.format} · {item.analysis.nodeCount} nodes</small></span><span>{new Date(item.createdAt).toLocaleString()}</span><span>{item.analysis.executionTime == null ? "N/A" : `${item.analysis.executionTime.toLocaleString()} ms`}</span><span>{item.analysis.primarySignal}</span><span>{item.analysis.score}/100 ›</span></button><button type="button" aria-label={`Delete ${item.title}`} onClick={() => onDeleteCase(item.id)}>Delete</button></div>)}</div></section>}
    </div>

  </section>;
}
