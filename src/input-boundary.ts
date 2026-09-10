import { z } from "zod";
import type { PlanEnvelope, PlanNode } from "./types.ts";

const envelopeSchema = z.object({ Plan: z.object({}).passthrough() }).passthrough();
const planInputSchema = z.union([envelopeSchema, z.array(envelopeSchema).length(1)]);
const aliases: Record<string, string> = { "Shared Blocks Read": "Shared Read Blocks", "Shared Blocks Hit": "Shared Hit Blocks", "Temporary Read Blocks": "Temp Read Blocks", "Temporary Written Blocks": "Temp Written Blocks", "Peak Memory": "Peak Memory Usage" };

export const MAX_PLAN_BYTES = 10_000_000;
export const MAX_PLAN_DEPTH = 100;
export const MAX_PLAN_NODES = 2_000;

// Bound the entire JSON structure before recursive consumers (including PEV2).
export function validatePlanStructure(root: unknown): void {
  const pending = [{ value: root, depth: 0 }];
  let entries = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > MAX_PLAN_DEPTH * 2 + 4) throw new Error("Plan nesting exceeds the safety limit.");
    if (++entries > 200_000) throw new Error("Plan contains too many fields.");
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Plan numbers must be finite.");
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Plan contains an unsupported property.");
        pending.push({ value: child, depth: depth + 1 });
      }
    }
  }
}

function validateNodes(root: PlanNode): void {
  const pending = [{ node: root, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++count > MAX_PLAN_NODES) throw new Error("Plan exceeds the 2,000 operation safety limit.");
    if (depth > MAX_PLAN_DEPTH) throw new Error("Plan exceeds the 100 level nesting safety limit.");
    if (!node || typeof node !== "object" || Array.isArray(node)) throw new Error("Each plan operation must be an object.");
    for (const key of ["Node Type", "Relation Name", "Schema", "Alias", "Index Name", "Filter", "Index Cond", "Hash Cond", "Merge Cond", "Join Filter"]) if (node[key] !== undefined && typeof node[key] !== "string") throw new Error(`Invalid text plan field: ${key}.`);
    if (node.Plans !== undefined && !Array.isArray(node.Plans)) throw new Error("Plan children must be an array.");
    if (node.Workers !== undefined && !Array.isArray(node.Workers)) throw new Error("Plan workers must be an array.");
    for (const [key, value] of Object.entries(node)) {
      if (/^(Actual |Plan Rows$|Plan Width$|Startup Cost$|Total Cost$|.* Blocks$|.* Time$|.* Loops$|Workers Planned$|Workers Launched$|Heap Fetches$|Rows Removed)/.test(key) && value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) throw new Error(`Invalid numeric plan field: ${key}.`);
    }
    for (const worker of node.Workers ?? []) pending.push({ node: worker as PlanNode, depth: depth + 1 });
    for (const child of node.Plans ?? []) pending.push({ node: child, depth: depth + 1 });
  }
}

function normalizeNode(node: PlanNode): PlanNode {
  const normalized: PlanNode = { ...node };
  for (const [from, to] of Object.entries(aliases)) if (from in normalized && !(to in normalized)) normalized[to] = normalized[from];
  if (Array.isArray(normalized.Workers)) normalized["Workers Launched"] ??= normalized.Workers.length;
  normalized.Plans = (normalized.Plans ?? []).map(normalizeNode);
  return normalized;
}

const numeric = (value: string | undefined) => { const parsed = value == null ? NaN : Number(value); return Number.isFinite(parsed) ? parsed : undefined; };

export function normalizeTextPlanClipboard(source: string) {
  const clipboardSource = source
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/""(?=(?:\s{2,}(?:->|[A-Z])|(?:Planning(?: Time)?|Execution Time|Settings|Query Identifier):))/g, "\"\n\"");
  return clipboardSource.split("\n").map((raw) => {
    const quoted = raw.match(/^\s*"([\s\S]*)"\s*,?\s*$/);
    return (quoted ? quoted[1] : raw).replace(/""/g, '"').replace(/\\+_/g, "_").replace(/\\"/g, '"');
  }).join("\n");
}

function parseTextPlan(source: string): PlanEnvelope {
  const stack: Array<{ indent: number; node: PlanNode }> = [];
  let root: PlanNode | undefined, executionTime: number | undefined, planningTime: number | undefined;
  const settings: Record<string, string> = {};
  const version = source.match(/PostgreSQL\s+(\d+)/i);
  const nodePattern = /^(\s*)(?:->\s*)?(.+?)\s+\(cost=([\d.]+)\.\.([\d.]+)\s+rows=(\d+).*?\)(?:\s+\(actual\s+time=([\d.]+)\.\.([\d.]+)\s+rows=(\d+)\s+loops=(\d+)\))?\s*$/;
  // Some SQL clients copy an entire result column as one physical line: each
  // logical EXPLAIN line is quoted and adjacent lines are separated by `""`.
  // They may also use non-breaking spaces for indentation. Restore the logical
  // lines before applying the ordinary per-line clipboard normalization.
  // Split adjacent quoted result rows, while preserving doubled quotes used
  // inside identifiers such as Subquery Scan on ""*SELECT* 1"".
  const normalizedSource = normalizeTextPlanClipboard(source);
  for (const raw of normalizedSource.split("\n")) {
    const line = raw.replace(/\t/g, "  "), match = line.match(nodePattern);
    if (match) {
      const indent = match[1].length + (line.includes("->") ? 2 : 0), label = match[2].trim();
      const indexed = label.match(/^(.*?)\s+using\s+([^\s]+)\s+on\s+(?:ONLY\s+)?([^\s]+)(?:\s+[^\s]+)?$/i);
      const relation = label.match(/^(.*?)\s+on\s+(?:ONLY\s+)?([^\s]+)(?:\s+[^\s]+)?$/i);
      const node: PlanNode = { "Node Type": indexed ? indexed[1].trim() : relation ? relation[1].trim() : label, "Relation Name": (indexed?.[3] ?? relation?.[2])?.replace(/^"|"$/g, ""), "Index Name": indexed?.[2]?.replace(/^"|"$/g, ""), "Total Cost": numeric(match[4]), "Plan Rows": numeric(match[5]), "Actual Total Time": numeric(match[7]), "Actual Rows": numeric(match[8]), "Actual Loops": numeric(match[9]), Plans: [] };
      while (stack.length && stack.at(-1)!.indent >= indent) stack.pop();
      if (stack.length) stack.at(-1)!.node.Plans!.push(node); else if (!root) root = node; else throw new Error("TEXT plan contains multiple root nodes.");
      stack.push({ indent, node }); continue;
    }
    const value = line.trim(); if (!value) continue;
    const planning = value.match(/^Planning Time:\s*([\d.]+)\s*ms/i); if (planning) { planningTime = Number(planning[1]); continue; }
    const execution = value.match(/^Execution Time:\s*([\d.]+)\s*ms/i); if (execution) { executionTime = Number(execution[1]); continue; }
    const settingsLine = value.match(/^Settings:\s*(.+)$/i);
    if (settingsLine) { for (const entry of settingsLine[1].split(/,\s*/)) { const setting = entry.match(/^([^=]+)=\s*'?([^']*)'?$/); if (setting) settings[setting[1].trim()] = setting[2].trim(); } continue; }
    const current = stack.at(-1)?.node, pair = value.match(/^([^:]+):\s*(.+)$/); if (!current || !pair) continue;
    const [, key, detail] = pair;
    if (/^(Filter|Index Cond|Recheck Cond|Hash Cond|Merge Cond|Join Filter|Output|Sort Key|Group Key)$/i.test(key)) current[key] = detail;
    else if (/^Rows Removed by (Filter|Join Filter)$/i.test(key)) current[key] = numeric(detail) ?? 0;
    else if (/^Heap Fetches$/i.test(key)) current["Heap Fetches"] = numeric(detail) ?? 0;
    else if (/^Workers Planned$/i.test(key)) current["Workers Planned"] = numeric(detail) ?? 0;
    else if (/^Workers Launched$/i.test(key)) current["Workers Launched"] = numeric(detail) ?? 0;
    else if (/^Sort Method$/i.test(key)) { current["Sort Method"] = detail; const disk = detail.match(/Disk:\s*(\d+)kB/i); if (disk) current["Temp Written Blocks"] = Math.ceil(Number(disk[1]) / 8); }
    else if (/^Buffers$/i.test(key)) {
      // Buffer classes share one line. Bound each match to its class so
      // `shared hit=… temp read=…` cannot report the temp value as a shared read.
      const shared = detail.match(/\bshared\s+(.+?)(?=\s+(?:local|temp)\s|$)/i)?.[1] ?? "";
      const temporary = detail.match(/\btemp\s+(.+?)(?=\s+(?:shared|local)\s|$)/i)?.[1] ?? "";
      const read = shared.match(/\bread=(\d+)/i), hit = shared.match(/\bhit=(\d+)/i), tempRead = temporary.match(/\bread=(\d+)/i), tempWritten = temporary.match(/\bwritten=(\d+)/i);
      if (read) current["Shared Read Blocks"] = Number(read[1]); if (hit) current["Shared Hit Blocks"] = Number(hit[1]); if (tempRead) current["Temp Read Blocks"] = Number(tempRead[1]); if (tempWritten) current["Temp Written Blocks"] = Number(tempWritten[1]);
    } else if (/^I\/O Timings$/i.test(key)) {
      const temporary = detail.match(/\btemp\s+(.+?)(?=\s+(?:shared|local)\s|$)/i)?.[1] ?? "";
      const tempRead = temporary.match(/\bread=([\d.]+)/i), tempWrite = temporary.match(/\bwrite=([\d.]+)/i);
      if (tempRead) current["Temp I/O Read Time"] = Number(tempRead[1]);
      if (tempWrite) current["Temp I/O Write Time"] = Number(tempWrite[1]);
    } else if (/^WAL$/i.test(key)) { const records = detail.match(/records=(\d+)/i), bytes = detail.match(/bytes=(\d+)/i); if (records) current["WAL Records"] = Number(records[1]); if (bytes) current["WAL Bytes"] = Number(bytes[1]); }
  }
  if (!root) throw new Error("Expected PostgreSQL FORMAT JSON or a TEXT plan beginning with a cost= node.");
  return { Plan: root, "Planning Time": planningTime, "Execution Time": executionTime, Settings: settings, __format: "TEXT", __postgresMajor: version ? Number(version[1]) : null };
}

export function parsePlanInput(source: string): PlanEnvelope {
  if (new TextEncoder().encode(source).byteLength > MAX_PLAN_BYTES) throw new Error("Plan exceeds the 10 MB safety limit.");
  let decoded: unknown; try { decoded = JSON.parse(source); } catch { const plan = parseTextPlan(source); validatePlanStructure(plan); validateNodes(plan.Plan); return plan; }
  validatePlanStructure(decoded);
  const result = planInputSchema.safeParse(decoded); if (!result.success) throw new Error("Expected a top-level PostgreSQL Plan object.");
  const raw = (Array.isArray(result.data) ? result.data[0] : result.data) as PlanEnvelope;
  for (const key of ["Planning Time", "Execution Time"]) if (raw[key] !== undefined && (typeof raw[key] !== "number" || !Number.isFinite(raw[key]) || raw[key] < 0)) throw new Error(`Invalid numeric plan field: ${key}.`);
  validateNodes(raw.Plan);
  const versionValue = raw["PostgreSQL Version"], version = typeof versionValue === "string" ? Number(versionValue.match(/\d+/)?.[0]) : null;
  return { ...raw, Plan: normalizeNode(raw.Plan), __format: "JSON", __postgresMajor: Number.isFinite(version) ? version : null };
}
