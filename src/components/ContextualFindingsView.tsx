import type { DatabaseContext } from "../database-context.ts";
import { typeCoercionDiagnosis } from "../type-coercion-diagnosis.ts";
import type { Analysis } from "../types.ts";
import { RecommendationsView } from "./WorkbenchViews.tsx";
import { CandidateIndexExperiments } from "./CandidateIndexExperiments.tsx";

export function ContextualFindingsView({ result, context }: { result: Analysis; context: DatabaseContext | null }) {
  const diagnosis = typeCoercionDiagnosis(result.planMap, context);
  const qualification = diagnosis.signal !== "none" ? <section className="coercion-qualification" aria-label="Type coercion qualification">
      <header><div><span>Type coercion qualification</span><strong>{diagnosis.summary}</strong></div><b className={`statistics-classification ${diagnosis.classification}`}>{diagnosis.classification}</b></header>
      <dl><div><dt>Captured evidence</dt><dd>{diagnosis.evidence}</dd></div><div><dt>Not established</dt><dd>{diagnosis.unknown}</dd></div><div><dt>Controlled next step</dt><dd>{diagnosis.nextAction}</dd></div></dl>
    </section> : undefined;
  return <RecommendationsView result={result} context={context} qualification={qualification} candidateExperiments={<CandidateIndexExperiments result={result} context={context} />} />;
}
