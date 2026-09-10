import type { Finding } from "./types.ts";

export interface ControlledExperiment {
  hypothesis: string;
  prerequisites: string[];
  action: string;
  successCriteria: string[];
  rollback: string;
}

export function controlledExperiment(finding: Finding): ControlledExperiment {
  const common = {
    prerequisites: ["Use the same SQL and representative parameter values.", "Capture normal settings, comparable cache state, and representative concurrency."],
    successCriteria: ["Repeated execution time improves materially, not only once.", "The measured evidence behind this finding falls without a material read, temp, WAL, or concurrency regression."],
    rollback: "Remove or revert only the tested change if the after-plan gate fails or workload risk increases.",
  };
  if (finding.id.startsWith("EST")) return { ...common, hypothesis: "Improved statistics or predicate information will correct cardinality and allow a better plan choice.", action: finding.nextAction, successCriteria: ["Plan Rows move materially closer to Actual Rows at the first divergent node.", ...common.successCriteria] };
  if (finding.id.startsWith("PATH")) return { ...common, hypothesis: "A selective, type-compatible access path can reduce rows filtered and buffer work.", action: finding.nextAction, prerequisites: [...common.prerequisites, "Confirm existing indexes, operator classes, column types, selectivity, write cost, and table size."], successCriteria: ["Rows removed and shared reads fall at the scan.", ...common.successCriteria] };
  if (finding.id.startsWith("MEM")) return { ...common, hypothesis: "Reducing the input or safely increasing operator memory will eliminate the direct spill.", action: finding.nextAction, prerequisites: [...common.prerequisites, "Calculate concurrent sort/hash memory exposure before changing work_mem."], successCriteria: ["Direct temp blocks or hash batches fall at the spill operation.", ...common.successCriteria] };
  if (finding.id.startsWith("TYPE")) return { ...common, hypothesis: "Aligning the originating expression type will remove the plan-visible coercion and restore type-compatible comparison/index use.", action: finding.nextAction, successCriteria: ["The cast disappears from the same plan expression.", ...common.successCriteria] };
  return { ...common, hypothesis: finding.detail, action: finding.nextAction };
}
