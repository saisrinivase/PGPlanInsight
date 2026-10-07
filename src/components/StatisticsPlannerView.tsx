import type { DatabaseContext } from "../database-context.ts";
import { statisticsDiagnosis } from "../statistics-diagnosis.ts";
import type { Analysis } from "../types.ts";
import { PlannerDiagnosticsView } from "./WorkbenchViews.tsx";

export function StatisticsPlannerView({ result, context, onViewNode }: { result: Analysis; context: DatabaseContext | null; onViewNode?: (rank: number) => void }) {
  const diagnosis = statisticsDiagnosis(result.planMap, context);
  return <PlannerDiagnosticsView result={result} diagnosis={diagnosis} onViewNode={onViewNode} />;
}
