import { Pev2Renderer } from "./Pev2Renderer.tsx";
export function DiagnosisWorkspace({ source }: { source: string }) {
  return <section className="diagnosis-workspace diagnosis-simple plan-only-workspace" aria-label="Execution plan">
    <div className="pev2-canvas"><Pev2Renderer planSource={source} /></div>
  </section>;
}
