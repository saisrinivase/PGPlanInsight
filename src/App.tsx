import { useEffect, useState } from "react";
import { analyzeOffThread } from "./analyze-client.ts";
import { Brand } from "./components/Brand.tsx";
import { IntakeV06 as Intake } from "./components/IntakeV06.tsx";
import { DiagnosisWorkspace } from "./components/DiagnosisWorkspace.tsx";
import { FixValidationView } from "./components/WorkbenchViews.tsx";
import type { Analysis } from "./types.ts";
import { clearCases, deleteCase, listCases, saveCase, type StoredCase } from "./case-store.ts";
import type { DatabaseContext } from "./database-context.ts";
import { DatabaseContextView } from "./components/DatabaseContextView.tsx";
import { StatisticsPlannerView } from "./components/StatisticsPlannerView.tsx";
import { ContextualFindingsView } from "./components/ContextualFindingsView.tsx";
import { EnvironmentDriftView } from "./components/EnvironmentDriftView.tsx";

type Tab = "diagnosis" | "validation" | "recommendations" | "context" | "planner";

export function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [planSource, setPlanSource] = useState("");
  const [tab, setTab] = useState<Tab>("diagnosis");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<StoredCase[]>([]);
  const [databaseContext, setDatabaseContext] = useState<DatabaseContext | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  useEffect(() => { listCases().then(setHistory).catch(() => setError("Local history could not be opened.")); }, []);
  useEffect(() => {
    if (!aboutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAboutOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [aboutOpen]);
  const reset = () => { setAnalysis(null); setPlanSource(""); setError(""); setTab("diagnosis"); };
  const analyze = async (source: string, title: string, retentionDays = 0) => {
    setBusy(true); setError("");
    try {
      const result = await analyzeOffThread(source);
      const item: StoredCase = { id: crypto.randomUUID(), title: title.trim() || `Plan ${new Date().toLocaleString()}`, source, analysis: result, createdAt: new Date().toISOString(), build: "pgplan_v0.5.0" };
      if (retentionDays > 0) { item.expiresAt = new Date(Date.now() + Math.min(retentionDays, 30) * 86400_000).toISOString(); await saveCase(item); setHistory(await listCases()); } setPlanSource(source); setAnalysis(result); setTab("diagnosis");
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Analysis failed."); }
    finally { setBusy(false); }
  };
  const openCase = (item: StoredCase) => { void analyze(item.source, item.title); };
  const clearHistory = async () => { try { await clearCases(); setHistory([]); } catch { setError("History could not be cleared. Please retry."); } };
  const removeCase = async (id: string) => { try { await deleteCase(id); setHistory(await listCases()); } catch { setError("Case could not be deleted. Please retry."); } };
  const view = !analysis ? <Intake onAnalyze={analyze} busy={busy} error={error} history={history} onOpenCase={openCase} onClearHistory={clearHistory} onDeleteCase={removeCase} /> : tab === "diagnosis" ? <DiagnosisWorkspace source={planSource} /> : tab === "validation" ? <FixValidationView current={analysis} /> : tab === "recommendations" ? <ContextualFindingsView result={analysis} context={databaseContext} /> : tab === "context" ? <><DatabaseContextView context={databaseContext} onChange={setDatabaseContext} /><EnvironmentDriftView target={databaseContext} /></> : <StatisticsPlannerView result={analysis} context={databaseContext} />;
  return <div className="shell"><header><Brand onHome={() => setAboutOpen(true)} /><div className="header-actions"><span className="privacy-state"><i />Browser-local analysis</span>{analysis && <button className="header-new" onClick={reset}>New analysis</button>}</div></header>{analysis && <nav className="focus-nav command-nav" aria-label="Analysis views"><button className={tab === "diagnosis" ? "active" : ""} onClick={() => setTab("diagnosis")}>Plan</button><button className={tab === "recommendations" ? "active" : ""} onClick={() => setTab("recommendations")}>Findings</button><button className={tab === "planner" ? "active" : ""} onClick={() => setTab("planner")}>Planner diagnostics</button><button className={tab === "validation" ? "active" : ""} onClick={() => setTab("validation")}>Validate fix</button><button className={tab === "context" ? "active" : ""} onClick={() => setTab("context")}>Database context {databaseContext ? "✓" : ""}</button></nav>}<main>{view}</main><footer><span>Deterministic analysis</span><span>Browser-local by design</span><span>TEXT and FORMAT JSON</span></footer>{aboutOpen && <div className="about-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAboutOpen(false); }}><section className="about-product" role="dialog" aria-modal="true" aria-labelledby="about-product-title"><button className="about-close" aria-label="Close product information" onClick={() => setAboutOpen(false)}>×</button><div className="section-kicker">PostgreSQL performance diagnostics</div><h2 id="about-product-title">Understand the evidence. Test the fix.</h2><p>PGPlan Insight turns PostgreSQL EXPLAIN plans into an evidence-led investigation for developers, DBAs, and architects.</p><dl><div><dt>What it does</dt><dd>Locates expensive operations, estimate drift, spills, access-path concerns, and plan-visible type coercion.</dd></div><div><dt>Safety boundary</dt><dd>Your plan stays in this browser. Nothing is sent to an AI provider or external service.</dd></div><div><dt>How to use it</dt><dd>Paste TEXT or FORMAT JSON, review measured findings, make one controlled change, then compare the after plan.</dd></div></dl><div className="about-actions"><button onClick={() => setAboutOpen(false)}>Continue analysis</button><button onClick={() => { setAboutOpen(false); reset(); }}>Start new analysis</button></div></section></div>}</div>;
}
