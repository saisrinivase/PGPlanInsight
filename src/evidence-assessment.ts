import type { Analysis, EvidenceClaim, Finding } from "./types.ts";

function suspectedCause(finding: Finding) {
  if (finding.id.startsWith("MEM")) return "The spill may be material to elapsed time; captured temp I/O timing and a controlled after plan are needed to prove impact.";
  if (finding.id.startsWith("EST")) return "Statistics, skew, correlation, parameter sensitivity, or expression semantics may explain the estimate drift.";
  if (finding.id.startsWith("PATH")) return "An alternative access path may reduce filtering work if the predicate is selective and indexable.";
  if (finding.id.startsWith("CPU")) return "Join order or repeated inner access may be amplifying otherwise small work.";
  if (finding.id.startsWith("TYPE")) return "A UNION, view output, parameter, or environment type drift may have introduced the visible cast.";
  return "The measured signal may contribute to runtime, but causality requires a controlled comparison.";
}

export function evidenceClaims(result: Analysis, finding: Finding): EvidenceClaim[] {
  const missing = result.checks.filter((check) => !check.present).map((check) => `${check.label}: ${check.value}`);
  return [
    { classification: "observed", status: "available", label: "Captured fact", detail: finding.evidence },
    { classification: "derived", status: "available", label: "Rule result", detail: finding.detail },
    { classification: "suspected", status: "available", label: "Cause to test", detail: suspectedCause(finding) },
    { classification: "unknown", status: "available", label: "Not established", detail: [...missing, "Catalog indexes, statistics freshness, data distribution, concurrency, and representative cache state are not proven by the plan."].join(" ") },
    { classification: "verified", status: "not-established", label: "After-plan proof", detail: "Not verified. Apply one controlled change and pass Fix Validation with comparable SQL, parameters, settings, cache state, concurrency, and repeated execution." },
  ];
}
