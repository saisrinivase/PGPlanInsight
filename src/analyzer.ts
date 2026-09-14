import type { Analysis, Finding, NodeMetric, PlanEnvelope, PlanNode, PlanVisualNode } from "./types.ts";
import { parsePlanInput } from "./input-boundary.ts";
import { coercionEvidence } from "./type-coercion.ts";
import { indexOnlyScanDiagnosis } from "./index-only-scan-diagnosis.ts";
import { typeCoercionDiagnosis } from "./type-coercion-diagnosis.ts";

const number = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const text = (value: unknown): string => value == null ? "" : String(value);

function flatten(root: PlanNode): PlanNode[] {
  const nodes: PlanNode[] = [];
  const visit = (node: PlanNode) => {
    nodes.push(node);
    (node.Plans ?? []).forEach(visit);
  };
  visit(root);
  return nodes;
}

function buildPlanMap(root: PlanNode, executionTime: number | null): PlanVisualNode[] {
  const rows: PlanVisualNode[] = [];
  const visit = (node: PlanNode, depth: number, path: string) => {
    const item = metric(node, rows.length + 1);
    const children = node.Plans ?? [];
    const childTime = children.reduce((sum, child) => sum + number(child["Actual Total Time"]) * Math.max(1, number(child["Actual Loops"])), 0);
    const flags: string[] = [];
    const tempReadBlocks = number(node["Temp Read Blocks"]), tempWrittenBlocks = number(node["Temp Written Blocks"]);
    const spillMethod = text(node["Sort Method"] || node["Storage Type"]);
    const directSpill = /external|disk/i.test(spillMethod) || number(node["Disk Usage"]) > 0 || number(node["HashAgg Batches"]) > 1 || number(node["Hash Batches"]) > 1 || number(node.Batches) > 1;
    if (directSpill) flags.push("spill");
    else if (item.tempBlocks > 0) flags.push("inherited-spill");
    if ((item.estimateRatio ?? 0) >= 10) flags.push("estimate");
    if (item.loops >= 500) flags.push("loops");
    if (/Seq Scan$/i.test(text(node["Node Type"]))) flags.push("scan");
    const expressionKeys = ["Index Cond", "Recheck Cond", "Hash Cond", "Merge Cond", "Join Filter", "Filter", "Output", "Sort Key", "Group Key"] as const;
    const expressions = expressionKeys.flatMap((source) => {
      const value = node[source];
      if (Array.isArray(value)) return value.map((entry) => ({ source, text: text(entry) })).filter((entry) => entry.text);
      const expression = text(value);
      return expression ? [{ source, text: expression }] : [];
    });
    if (coercionEvidence(expressions).length) flags.push("coercion");
    rows.push({
      ...item,
      depth,
      path,
      selfTime: Math.max(0, item.totalTime - childTime),
      timeShare: executionTime && executionTime > 0 ? Math.min(100, item.totalTime / executionTime * 100) : 0,
      flags,
      workersPlanned: number(node["Workers Planned"]),
      workersLaunched: number(node["Workers Launched"]),
      predicate: text(node["Index Cond"] ?? node["Recheck Cond"] ?? node["Hash Cond"] ?? node["Merge Cond"] ?? node["Join Filter"] ?? node["Filter"]),
      actualTimingCaptured: typeof node["Actual Total Time"] === "number" && typeof node["Actual Rows"] === "number" && typeof node["Actual Loops"] === "number",
      heapFetches: typeof node["Heap Fetches"] === "number" ? node["Heap Fetches"] : null,
      rowsRemovedByFilter: number(node["Rows Removed by Filter"]),
      sharedHits: number(node["Shared Hit Blocks"]),
      tempReadBlocks,
      tempWrittenBlocks,
      tempReadTime: number(node["Temp I/O Read Time"]),
      tempWriteTime: number(node["Temp I/O Write Time"]),
      spillRole: directSpill ? "direct" : item.tempBlocks > 0 ? "inherited" : null,
      spillMethod,
      expressions,
    });
    children.forEach((child, index) => visit(child, depth + 1, `${path}.${index + 1}`));
  };
  visit(root, 0, "1");
  return rows;
}

function normalizeSettings(value: PlanEnvelope["Settings"]): Array<{ name: string; value: string }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => Object.entries(item).map(([name, setting]) => ({ name, value: text(setting) })));
  }
  return Object.entries(value).map(([name, setting]) => ({ name, value: text(setting) }));
}

function memoryMb(value: string): number {
  const match = value.trim().match(/^([\d.]+)\s*(kb|mb|gb)?$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "kb").toLowerCase();
  return amount * (unit === "gb" ? 1024 : unit === "mb" ? 1 : 1 / 1024);
}

function metric(node: PlanNode, rank: number): NodeMetric {
  const actual = number(node["Actual Rows"]);
  const planned = number(node["Plan Rows"]);
  return {
    rank,
    nodeType: text(node["Node Type"]) || "Unknown node",
    relation: text(node["Relation Name"] ?? node["Index Name"]) || "—",
    totalTime: number(node["Actual Total Time"]) * Math.max(1, number(node["Actual Loops"])),
    rows: actual,
    plannedRows: planned,
    loops: number(node["Actual Loops"]),
    estimateRatio: planned > 0 ? Math.max(actual / planned, planned / Math.max(actual, 1)) : null,
    tempBlocks: number(node["Temp Read Blocks"]) + number(node["Temp Written Blocks"]),
    sharedReads: number(node["Shared Read Blocks"]),
  };
}

export function analyzePlan(source: string): Analysis {
  const envelope = parsePlanInput(source);
  const nodes = flatten(envelope.Plan);
  const settings = normalizeSettings(envelope.Settings);
  const settingsCaptured = Object.prototype.hasOwnProperty.call(envelope, "Settings");
  const runtime = typeof envelope["Execution Time"] === "number" || nodes.some((node) => typeof node["Actual Total Time"] === "number");
  const buffers = nodes.some((node) => "Shared Read Blocks" in node || "Shared Hit Blocks" in node);
  const temp = nodes.some((node) => number(node["Temp Read Blocks"]) + number(node["Temp Written Blocks"]) > 0);
  const wal = nodes.some((node) => "WAL Records" in node || "WAL Bytes" in node);
  const planningTime = typeof envelope["Planning Time"] === "number" ? envelope["Planning Time"] : null;
  const executionTime = typeof envelope["Execution Time"] === "number" ? envelope["Execution Time"] : null;
  const planMap = buildPlanMap(envelope.Plan, executionTime);
  const root = envelope.Plan;
  const maxRowsRemoved = Math.max(0, ...nodes.map((node) => (number(node["Rows Removed by Filter"]) + number(node["Rows Removed by Join Filter"])) * Math.max(1, number(node["Actual Loops"]))));
  const maxLoops = Math.max(0, ...nodes.map((node) => number(node["Actual Loops"])));
  const maxHashBatches = Math.max(0, ...nodes.map((node) => number(node["HashAgg Batches"]) || number(node["Hash Batches"]) || number(node.Batches)));
  const workersPlanned = Math.max(0, ...nodes.map((node) => number(node["Workers Planned"])));
  const workersLaunched = Math.max(0, ...nodes.map((node) => number(node["Workers Launched"])));
  const metrics = {
    rootSharedHits: number(root["Shared Hit Blocks"]), rootSharedReads: number(root["Shared Read Blocks"]),
    rootTempBlocks: number(root["Temp Read Blocks"]) + number(root["Temp Written Blocks"]),
    rootWalRecords: number(root["WAL Records"]), rootWalBytes: number(root["WAL Bytes"]),
    maxRowsRemoved, maxLoops, maxHashBatches, workersPlanned, workersLaunched,
  };
  const checks = [
    { label: "Runtime", present: runtime, value: runtime ? "Actual node timing present" : "Estimated-only capture" },
    { label: "Buffers", present: buffers, value: buffers ? "Buffer counters present" : "No buffer counters" },
    { label: "Settings", present: settingsCaptured, value: !settingsCaptured ? "Not captured" : settings.length ? `${settings.length} non-default` : "Captured; no non-default values" },
    { label: "WAL", present: wal, value: wal ? "WAL counters present" : "Not captured" },
  ];
  const score = Math.min(100, 25 + (runtime ? 30 : 0) + (buffers ? 20 : 0) + (settingsCaptured ? 15 : 0) + (wal ? 10 : 0));
  const findings: Finding[] = [];
  const hotspots = nodes.map((node, index) => metric(node, index + 1)).sort((a, b) => b.totalTime - a.totalTime).slice(0, 8).map((item, index) => ({ ...item, rank: index + 1 }));
  const elevatedWorkMem = settings.find((setting) => setting.name.toLowerCase() === "work_mem" && memoryMb(setting.value) >= 512);
  const spillSource = planMap.find((node) => node.spillRole === "direct");
  const spill = spillSource ?? (temp ? planMap.find((node) => node.tempBlocks > 0) : undefined);
  const badEstimate = hotspots.find((item) => (item.estimateRatio ?? 0) >= 10);
  const seqScan = nodes.find((node) => {
    if (!/Seq Scan$/i.test(text(node["Node Type"]))) return false;
    const loops = Math.max(1, number(node["Actual Loops"]));
    const removed = number(node["Rows Removed by Filter"]) * loops;
    const returned = number(node["Actual Rows"]) * loops;
    return removed >= 10000 && removed >= Math.max(10000, returned * 5);
  });
  const highLoops = hotspots.find((item) => item.loops >= 10 && (item.sharedReads * item.loops >= 10000 || item.totalTime >= Math.max(50, (executionTime ?? 0) * 0.2)));
  const parallelSuppressed = settings.some((setting) => setting.name === "max_parallel_workers_per_gather" && setting.value === "0") && nodes.some((node) => node["Node Type"] === "Seq Scan" && number(node["Actual Rows"]) >= 100000);
  const writeWal = /ModifyTable|Insert|Update|Delete/.test(text(root["Node Type"])) && (metrics.rootWalRecords >= 1000 || metrics.rootWalBytes >= 1048576);
  const limitNode = nodes.find((node) => node["Node Type"] === "Limit");
  const largeOffset = limitNode && (limitNode.Plans ?? []).some((child) => number(child["Actual Rows"]) >= Math.max(10000, number(limitNode["Actual Rows"]) * 100));
  const coercions = planMap.flatMap((node) => coercionEvidence(node.expressions ?? []).map((evidence) => ({ node, evidence })));
  const coercionDiagnosis = typeCoercionDiagnosis(planMap, null);
  const indexOnlyReview = planMap.map((node) => ({ node, diagnosis: indexOnlyScanDiagnosis(node) }))
    .filter((item) => item.diagnosis?.review)
    .sort((a, b) => b.node.totalTime - a.node.totalTime)[0];
  const genericLoopDuplicatesIndexOnly = Boolean(indexOnlyReview?.diagnosis?.signal === "loop-amplified" && highLoops
    && indexOnlyReview.node.nodeType === highLoops.nodeType
    && indexOnlyReview.node.relation === highLoops.relation
    && indexOnlyReview.node.loops === highLoops.loops
    && indexOnlyReview.node.totalTime === highLoops.totalTime);
  if (!runtime) findings.push({ id: "EV-001", title: "Runtime evidence is missing", detail: "This capture can describe shape and cost, but it cannot prove where elapsed time was spent.", severity: "critical", evidence: "Execution Time / Actual timing absent", nextAction: "Capture EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)." });
  if (elevatedWorkMem) findings.push({ id: "ENV-001", title: "Elevated work_mem may make this capture non-representative", detail: `The plan was captured with work_mem=${elevatedWorkMem.value}. Memory can multiply across active sort/hash operators and concurrent sessions.`, severity: "critical", evidence: `Settings.work_mem = ${elevatedWorkMem.value}`, nextAction: "Re-test under normal environment guardrails and review PostgreSQL/RDS memory logs." });
  if (spill) {
    const ioTime = spillSource ? spillSource.tempReadTime + spillSource.tempWriteTime : 0;
    findings.push({ id: "MEM-001", title: spillSource ? `Direct spill at ${spillSource.nodeType}` : "Temporary I/O requires source attribution", detail: spillSource ? `${spillSource.nodeType} operation ${spillSource.rank} recorded ${spillSource.tempReadBlocks.toLocaleString()} temp blocks read and ${spillSource.tempWrittenBlocks.toLocaleString()} written${spillSource.spillMethod ? ` using ${spillSource.spillMethod}` : ""}${maxHashBatches > 1 ? ` with ${maxHashBatches.toLocaleString()} hash batches` : ""}${ioTime > 0 ? `. Captured temp I/O time was ${ioTime.toFixed(2)} ms; compare that with total runtime before calling the spill dominant.` : "."}` : `The root reports ${metrics.rootTempBlocks.toLocaleString()} inclusive temporary block operations, but this capture does not expose a direct spill-capable source.`, severity: "warning", evidence: spillSource ? `Direct ${spillSource.nodeType} spill evidence at operation ${spillSource.rank}` : "Inclusive root temp counters only", nextAction: "Test one memory or query-shape change and verify direct temp blocks/batches and runtime fall without unsafe session memory." });
  }
  if (badEstimate) findings.push({ id: "EST-001", title: "Cardinality estimate drift", detail: `${badEstimate.nodeType} differs from its estimate by ${badEstimate.estimateRatio?.toFixed(1)}×.`, severity: "warning", evidence: `Plan Rows vs Actual Rows at ${badEstimate.nodeType}`, nextAction: "Inspect column statistics and correlation; refresh targeted statistics, then compare the new plan." });
  if (seqScan) findings.push({ id: "PATH-001", title: "High-volume sequential scan filtering", detail: `${text(seqScan["Relation Name"]) || "A relation"} recorded ${(number(seqScan["Rows Removed by Filter"]) * Math.max(1, number(seqScan["Actual Loops"]))).toLocaleString()} rows removed by the filter relative to its returned rows.`, severity: "warning", evidence: "Rows Removed by Filter is at least 5× returned rows and at least 10,000", nextAction: "Validate predicate selectivity and indexability before proposing an index." });
  if (indexOnlyReview?.diagnosis) findings.push({ id: "IOS-001", title: indexOnlyReview.diagnosis.summary, detail: indexOnlyReview.diagnosis.evidence, severity: "warning", evidence: `${indexOnlyReview.diagnosis.classification}: ${indexOnlyReview.node.nodeType} at operation ${indexOnlyReview.node.rank}`, nextAction: indexOnlyReview.diagnosis.nextAction });
  if (highLoops && !genericLoopDuplicatesIndexOnly) findings.push({ id: "CPU-001", title: "Loop amplification", detail: `${highLoops.nodeType} executed ${highLoops.loops.toLocaleString()} times. Small inner-node costs may be multiplying into material CPU time.`, severity: "warning", evidence: `Actual Loops = ${highLoops.loops}`, nextAction: "Check join cardinality and whether the inner access path can be reduced or materialized." });
  if (parallelSuppressed) findings.push({ id: "PAR-001", title: "Parallel execution was explicitly suppressed", detail: "A high-volume scan ran with max_parallel_workers_per_gather=0.", severity: "warning", evidence: "Settings.max_parallel_workers_per_gather = 0 with a high-volume Seq Scan", nextAction: "Compare under normal parallel settings; verify workers launch and runtime improves before changing production policy." });
  if (writeWal) findings.push({ id: "WAL-001", title: "Material WAL generation", detail: `${metrics.rootWalRecords.toLocaleString()} WAL records and ${metrics.rootWalBytes.toLocaleString()} WAL bytes were measured at the modifying root.`, severity: "warning", evidence: "ModifyTable root WAL counters", nextAction: "Validate replica lag, WAL bandwidth, checkpoint pressure, and batch size under representative concurrency." });
  if (largeOffset) findings.push({ id: "PAGE-001", title: "Large OFFSET discards substantial index work", detail: `The child node processed ${number(limitNode?.Plans?.[0]?.["Actual Rows"]).toLocaleString()} rows to return ${number(limitNode?.["Actual Rows"]).toLocaleString()}.`, severity: "warning", evidence: "Limit child Actual Rows is at least 100× output rows", nextAction: "Test keyset pagination using the last seen ordering key and compare runtime and buffer accesses." });
  if (coercions.length) {
    findings.push({ id: "TYPE-001", title: "Plan-visible type coercion", detail: `${coercionDiagnosis.summary} ${coercionDiagnosis.unknown}`, severity: coercionDiagnosis.cast?.context === "predicate" ? "warning" : "info", evidence: coercionDiagnosis.evidence, nextAction: coercionDiagnosis.nextAction });
  }
  const planningDominates = planningTime != null && executionTime != null && planningTime >= 10 && planningTime > executionTime * 2;
  const primarySignal = !runtime ? "Capture quality" : elevatedWorkMem ? "Capture guardrail" : planningDominates ? "Planning overhead" : spill ? "Memory / spill" : writeWal ? "WAL / write pressure" : largeOffset ? "Pagination work" : parallelSuppressed ? "Parallelism" : badEstimate ? "Estimate drift" : indexOnlyReview ? "Index-only access" : highLoops ? "CPU loop amplification" : seqScan ? "Access path" : coercions.length ? "Type coercion" : "No dominant risk detected";
  if (!findings.length) findings.push({ id: "BASE-001", title: "No high-confidence risk crossed the current thresholds", detail: "The captured evidence does not show a dominant spill, estimate, scan, or loop-amplification signal.", severity: "info", evidence: `${nodes.length} nodes analyzed`, nextAction: "Compare against a known slow baseline before accepting a tuning change." });
  return {
    format: envelope.__format ?? "JSON", postgresMajor: envelope.__postgresMajor ?? null, adapter: envelope.__postgresMajor ? `PostgreSQL ${envelope.__postgresMajor} normalized` : "PostgreSQL canonical",
    score, evidenceLevel: score >= 80 ? "Strong" : score >= 55 ? "Usable" : "Weak",
    executionTime, planningTime, nodeCount: nodes.length, primarySignal,
    headline: runtime ? `${primarySignal} is the strongest deterministic signal in this capture.` : "Evidence is too weak for runtime hotspot claims.",
    checks, findings, hotspots, planMap, settings, metrics,
  };
}
