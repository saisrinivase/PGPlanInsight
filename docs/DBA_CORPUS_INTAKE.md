# Independent DBA corpus intake

Status: awaiting sanitized plans and case-specific reviewer decisions. General pilot approval is not a labelled diagnostic corpus. The existing 18-case score is synthetic regression conformance only.

## Provide per case

1. Sanitized TEXT or JSON plan and PostgreSQL version; retain node hierarchy, timings, rows, loops and counters. Identify omissions/redactions and whether data is synthetic or captured. Never include credentials, device files, private connection strings or unapproved business data.
2. Optional sanitized Context Pack, clearly separated from plan-only evidence. SQL/view/UNION lineage requires sanitized definitions where relevant; a cast in a plan is not proof of its origin or index impact.
3. Expected **observed symptom**, exact evidence operation/predicate, allowed hypotheses, forbidden causal claims, missing evidence and one controlled next test.
4. Positive, negative or unknown decision **for each specific diagnostic**, not one whole-plan good/bad label. Unknown is required where evidence cannot support a decision.
5. Reviewer identifier/role, review date, whether the reviewer saw tool output first, second reviewer decision and adjudication of disagreements. Share names only with permission; pseudonyms suffice.
6. For verified performance outcomes, independent before/after repeated captures and comparability declarations. One captured plan cannot establish causality or workload-wide benefit.

## Representative cohorts

Include positive, harmless/control and incomplete-evidence cases for: visible predicate casts versus constant/output casts; expensive versus cheap repeated index probes; heap fetches versus read counters; estimate drift versus zero/never-executed nodes; direct versus ancestor-inclusive spills; existing index coverage/overlap with and without catalog evidence; parallel workers; partition pruning; reads/writes and WAL. Record versions and plan-only/context-assisted scope separately. Do not call a small convenience sample representative of all production workloads.

## Review and reporting

Reviewers should label without first seeing tool diagnoses where possible. Keep held-out cases separate from development fixtures. Preserve disagreements and corrections. Run the versioned scorer only after labels and evidence are accepted; do not tune rules to the held-out results and then call them unseen accuracy.

Report per-family counts, false positives/negatives, safe abstentions, unsupported-claim rate, priority agreement, and uncertainty. Missing/undefined denominators remain N/A. Until accepted reviewed files exist, `independentDbaReviewed` stays false and production accuracy stays unknown. This checklist is not itself an evaluated corpus.
