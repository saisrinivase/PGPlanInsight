# Diagnostic accuracy status

PGPlan Insight currently has **100% conformance on its maintained automated corpus**: every implemented deterministic rule, negative fixture, incomplete-evidence case, and browser workflow in the release gate passes.

This is not the same as real-world root-cause accuracy. A production percentage is **not established** because the project does not yet have an independent, DBA-labelled benchmark corpus with agreed expected findings.

## Accuracy benchmark required

For every anonymized plan, independent reviewers should record the primary symptom, evidence-supported hypotheses, unsafe conclusions, required missing context, and the controlled validation step. Measure:

- finding precision: reported findings judged correct / all reported findings;
- finding recall: expected findings detected / all expected findings;
- unsafe-claim rate: unsupported causal claims / all claims;
- top-priority agreement: cases where the first investigation matches the reviewer consensus;
- evidence calibration: observed, derived, suspected, unknown, and verified labels used correctly.

Do not publish a percentage until the corpus covers PostgreSQL versions, read/write plans, joins, partitioning, parallelism, spills, estimate drift, casts, index-only scans, parameter skew, and incomplete captures. Report confidence intervals and disagreements, not only one aggregate score.
