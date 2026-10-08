import { Pev2Renderer } from "./Pev2Renderer.tsx";
export function DiagnosisWorkspace({ source, appearance }: { source: string; appearance: "light" | "dark" }) {
  return <section className="diagnosis-workspace diagnosis-simple plan-only-workspace" aria-label="Execution plan">
    <div className="pev2-canvas"><Pev2Renderer planSource={source} appearance={appearance} /></div>
  </section>;
}
