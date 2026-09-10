import { parsePlanInput } from "./input-boundary.ts";
import type { PlanNode } from "./types.ts";

const operations = new Set(["Result", "ProjectSet", "ModifyTable", "Append", "Merge Append", "Recursive Union", "BitmapAnd", "BitmapOr", "Nested Loop", "Merge Join", "Hash Join", "Seq Scan", "Sample Scan", "Index Scan", "Index Only Scan", "Bitmap Index Scan", "Bitmap Heap Scan", "Tid Scan", "Tid Range Scan", "Subquery Scan", "Function Scan", "Table Function Scan", "Values Scan", "CTE Scan", "Named Tuplestore Scan", "WorkTable Scan", "Foreign Scan", "Custom Scan", "Materialize", "Memoize", "Sort", "Incremental Sort", "Group", "Aggregate", "WindowAgg", "Unique", "Gather", "Gather Merge", "Hash", "SetOp", "LockRows", "Limit"]);
const metrics = new Set(["Startup Cost", "Total Cost", "Plan Rows", "Plan Width", "Actual Startup Time", "Actual Total Time", "Actual Rows", "Actual Loops", "Shared Hit Blocks", "Shared Read Blocks", "Shared Dirtied Blocks", "Shared Written Blocks", "Local Hit Blocks", "Local Read Blocks", "Local Dirtied Blocks", "Local Written Blocks", "Temp Read Blocks", "Temp Written Blocks", "I/O Read Time", "I/O Write Time", "Temp I/O Read Time", "Temp I/O Write Time", "Rows Removed by Filter", "Rows Removed by Join Filter", "Rows Removed by Index Recheck", "Heap Fetches", "Workers Planned", "Workers Launched", "Worker Number", "Hash Buckets", "Original Hash Buckets", "Hash Batches", "Original Hash Batches", "Peak Memory Usage", "Sort Space Used", "WAL Records", "WAL FPI", "WAL Bytes"]);

// An allowlist deliberately drops expressions, query text, settings and unknown fields.
// Regex literal replacement cannot guarantee redaction of PostgreSQL SQL syntax.
export function redactPlanForSharing(source: string): string {
  const envelope = parsePlanInput(source);
  const identifiers = new Map<string, string>();
  const node = (input: PlanNode): Record<string, unknown> => {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (metrics.has(key) && typeof value === "number") output[key] = value;
      else if (key === "Node Type") { if (!operations.has(String(value))) throw new Error("This operation type cannot be safely redacted yet. Review the plan manually."); output[key] = value; }
      else if (["Relation Name", "Schema", "Alias", "Index Name", "CTE Name"].includes(key) && typeof value === "string") {
        const lookup = `${key}:${value}`;
        if (!identifiers.has(lookup)) identifiers.set(lookup, `object_${identifiers.size + 1}`);
        output[key] = identifiers.get(lookup);
      } else if (["Parallel Aware", "Async Capable", "Inner Unique", "Single Copy"].includes(key) && typeof value === "boolean") output[key] = value;
      else if (key === "Plans" && Array.isArray(value)) output.Plans = value.map(node);
      else if (key === "Workers" && Array.isArray(value)) output.Workers = value.map(node);
    }
    return output;
  };
  return JSON.stringify([{ Plan: node(envelope.Plan), "Planning Time": envelope["Planning Time"], "Execution Time": envelope["Execution Time"] }], null, 2);
}
