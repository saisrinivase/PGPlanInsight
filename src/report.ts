import type { Analysis, Finding, PlanVisualNode } from "./types.ts";
import { nodeSignal } from "./node-signal.ts";
import { rootCauseTrace } from "./root-cause-trace.ts";
import { coercionEvidence } from "./type-coercion.ts";
import { controlledExperiment } from "./controlled-experiment.ts";
import { evidenceClaims } from "./evidence-assessment.ts";

const numeric = (value: number, digits = 0) => value.toLocaleString("en-US", { maximumFractionDigits: digits });
const ms = (value: number | null) => value == null ? "Not captured" : `${numeric(value, 2)} ms`;
const safe = (value: string) => value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const label = (node: PlanVisualNode) => `${node.nodeType}${node.relation === "—" ? "" : ` on ${node.relation}`}`;

function likelyNode(nodes: PlanVisualNode[], finding: Finding): PlanVisualNode | null {
  const candidates = finding.id.startsWith("MEM") ? nodes.filter((node) => node.flags.includes("spill"))
    : finding.id.startsWith("EST") ? nodes.filter((node) => node.flags.includes("estimate"))
    : finding.id.startsWith("PATH") ? nodes.filter((node) => node.flags.includes("scan"))
    : finding.id.startsWith("CPU") ? nodes.filter((node) => node.flags.includes("loops"))
    : finding.id.startsWith("TYPE") ? nodes.filter((node) => node.flags.includes("coercion")) : nodes;
  return [...(candidates.length ? candidates : nodes)].sort((a, b) => b.selfTime - a.selfTime || b.sharedReads - a.sharedReads)[0] ?? null;
}

function investigation(result: Analysis): string[] {
  return result.findings.flatMap((finding, index) => {
    const node = likelyNode(result.planMap, finding);
    const trace = node ? rootCauseTrace(result.planMap, node) : null;
    const experiment = controlledExperiment(finding);
    const claims = evidenceClaims(result, finding);
    return [
      `### ${index + 1}. ${finding.title} (${finding.id})`, "", finding.detail, "",
      `- **Observed evidence:** ${finding.evidence}`,
      `- **Inspect first:** ${node ? `${label(node)} (operation ${node.rank})` : "No operation could be resolved"}`,
      ...(trace ? [`- **Causal trace:** ${trace.chain.map(label).join(" → ")}`, `- **Trace boundary:** ${trace.boundary}`] : []),
      ...claims.map((claim) => `- **${claim.classification.toUpperCase()} · ${claim.label}${claim.status === "not-established" ? " (not established)" : ""}:** ${claim.detail}`),
      `- **Hypothesis:** ${experiment.hypothesis}`,
      `- **Prerequisites:** ${experiment.prerequisites.join(" ")}`,
      `- **Controlled action:** ${experiment.action}`,
      `- **Success gate:** ${experiment.successCriteria.join(" ")}`,
      `- **Rollback boundary:** ${experiment.rollback}`, "",
    ];
  });
}

function operationRows(result: Analysis): string[] {
  return [...result.planMap].sort((a, b) => b.selfTime - a.selfTime || b.totalTime - a.totalTime).slice(0, Math.min(10, result.planMap.length)).map((node, index) => {
    const signal = nodeSignal(node);
    return `| ${index + 1} | ${safe(label(node))} | ${safe(signal.label)} | ${numeric(node.selfTime, 2)} | ${numeric(node.totalTime, 2)} | ${numeric(node.timeShare, 1)}% | ${numeric(node.rows)} × ${numeric(Math.max(1, node.loops))} | ${numeric(node.sharedReads)} | ${numeric(node.tempBlocks)} |`;
  });
}

function coercionRows(result: Analysis): string[] {
  return result.planMap.flatMap((node) => coercionEvidence(node.expressions ?? []).map((item) => `- **${label(node)} · ${item.source}:** \`${item.expression}\` → target type \`${item.targetType}\`. The cast is proven; material runtime impact and its origin are not.`));
}

function planTree(result: Analysis): string[] {
  return result.planMap.map((node, index) => {
    const signal = nodeSignal(node);
    const branch = node.depth === 0 ? "" : `${"│  ".repeat(Math.max(0, node.depth - 1))}└─ `;
    return `${branch}${String(index + 1).padStart(2, "0")} ${label(node)} [${signal.label.toUpperCase()}] — self ${numeric(node.selfTime, 2)} ms; inclusive ${numeric(node.totalTime, 2)} ms; rows ${numeric(node.rows)} × loops ${numeric(Math.max(1, node.loops))}; reads ${numeric(node.sharedReads)}; temp ${numeric(node.tempBlocks)}`;
  });
}

export function buildAnalysisReport(result: Analysis): string {
  const coercions = coercionRows(result);
  const missing = result.checks.filter((check) => !check.present);
  return [
    "# PGPlan Insight — DBA Triage Report", "",
    "> Purpose: identify where to investigate first and define a controlled validation. This is not a production change approval.", "",
    "## Capture summary", "", "| Signal | Value |", "|---|---|",
    `| Primary signal | ${safe(result.primarySignal)} |`, `| Execution time | ${ms(result.executionTime)} |`, `| Planning time | ${ms(result.planningTime)} |`,
    `| Evidence | ${result.score}/100 · ${result.evidenceLevel} |`, `| Operations | ${numeric(result.nodeCount)} |`, `| Input | ${result.format} · ${safe(result.adapter)} |`, "",
    "## Investigation order", "", ...investigation(result),
    "## Highest exclusive-work operations", "", "Exclusive/self time is prioritized here because inclusive time contains child work.", "",
    "| # | Operation | Status | Self ms | Inclusive ms | Plan share | Rows × loops | Reads | Temp |", "|---:|---|---|---:|---:|---:|---:|---:|---:|", ...operationRows(result), "",
    "## Type-coercion evidence", "", ...(coercions.length ? coercions : ["No column-expression cast was visible in the captured plan fields."]), "",
    "## Evidence limitations", "", ...(missing.length ? missing.map((check) => `- **${check.label}:** ${check.value}`) : ["- Runtime, buffer, settings, and WAL capture checks are present."]),
    "- The plan does not prove catalog state, all existing indexes, table definitions, statistics freshness, data distribution, parameter types, concurrency, or cache representativeness.", "",
    "## Complete execution tree", "", "Operations are numbered in execution-tree order. Indentation replaces long dotted paths.", "", "```text", ...planTree(result), "```", "",
    "## Validation guardrail", "", "Change one variable at a time. Capture the after plan with the same SQL, parameters, PostgreSQL settings, representative cache state, and comparable concurrency. Use Fix Validation before accepting a performance claim.", "",
  ].join("\n");
}

export function saveLocalReport(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
