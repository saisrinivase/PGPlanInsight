export interface SamplePlan {
  id: string;
  title: string;
  description: string;
  category: "diagnostic" | "scale";
  nodeCount?: number;
  path?: string;
}

export const SAMPLE_PLANS: SamplePlan[] = [
  { id: "sort-spill", title: "Sort spill", description: "Temporary-block I/O caused by a sort that exceeded available memory.", category: "diagnostic", path: "/samples/memory_spill_plan.json" },
  { id: "loop-amplification", title: "Nested-loop amplification", description: "A fast inner lookup repeated enough times to dominate total execution.", category: "diagnostic", path: "/samples/cpu_nested_loop_plan.json" },
  { id: "cast-join", title: "Join with visible cast", description: "Join evidence containing plan-visible type coercion and material reads.", category: "diagnostic", path: "/samples/io_join_cast_plan.json" },
  { id: "parallel-limit", title: "Limited parallelism", description: "A measured parallel operation with incomplete worker evidence.", category: "diagnostic", path: "/samples/parallel_limited_plan.json" },
  { id: "bind-loop", title: "Production-style deep loop", description: "A deeper ten-node join chain with repeated index access and estimate drift.", category: "diagnostic", path: "/samples/real_bind_loop_churn_plan.json" },
  { id: "wal-write", title: "WAL-heavy write", description: "Write-amplification evidence with WAL records, bytes, and full-page images.", category: "diagnostic", path: "/samples/wal_write_bound_plan.json" },
  ...[100, 500, 1_000, 2_000].map((nodeCount): SamplePlan => ({
    id: `scale-${nodeCount}`,
    title: `${nodeCount.toLocaleString()}-node plan`,
    description: "Synthetic partition fan-out for validating Plan, Grid, and Raw navigation at scale.",
    category: "scale",
    nodeCount,
  })),
];

export function buildScaleSample(nodeCount: number): string {
  if (!Number.isInteger(nodeCount) || nodeCount < 2 || nodeCount > 2_000) throw new Error("Scale sample must contain between 2 and 2,000 nodes.");
  const leaf = (index: number) => ({
    "Node Type": "Seq Scan",
    "Relation Name": `events_p${String(index).padStart(4, "0")}`,
    "Alias": `e${index}`,
    "Startup Cost": 0,
    "Total Cost": 18.5,
    "Plan Rows": 250,
    "Plan Width": 48,
    "Actual Startup Time": 0.01,
    "Actual Total Time": 0.18,
    "Actual Rows": 220,
    "Actual Loops": 1,
    "Shared Hit Blocks": 4,
    "Filter": "event_time >= $1 AND event_time < $2",
  });
  const executionTime = Number((nodeCount * 0.18 + 2.4).toFixed(3));
  return JSON.stringify([{
    Plan: {
      ...leaf(0),
      "Node Type": "Append",
      "Actual Total Time": Number((executionTime - 0.4).toFixed(3)),
      "Actual Rows": (nodeCount - 1) * 220,
      "Plan Rows": (nodeCount - 1) * 250,
      "Shared Hit Blocks": (nodeCount - 1) * 4,
      Plans: Array.from({ length: nodeCount - 1 }, (_, index) => leaf(index + 1)),
    },
    "Planning Time": 2.1,
    "Execution Time": executionTime,
  }], null, 2);
}

export async function loadSamplePlan(sample: SamplePlan): Promise<string> {
  if (sample.nodeCount) return buildScaleSample(sample.nodeCount);
  if (!sample.path) throw new Error("Sample source is unavailable.");
  const response = await fetch(sample.path);
  if (!response.ok) throw new Error("Sample could not be loaded.");
  return response.text();
}
