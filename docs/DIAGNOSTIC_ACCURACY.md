# Diagnostic accuracy status

Automated regression conformance must be established for each commit; it is not a standing claim that every diagnostic rule or browser workflow passes.

## Reproducible scoring harness

Run `npm run test:accuracy`. The report is `test-results/diagnostic-score.json`; ordinary `npm test` also executes the benchmark and fails on any decision mismatch. The initial five synthetic cases cover selected index-only and missing-runtime decisions, not the whole diagnostic engine. No UI or database access is involved.

Precision, recall, false-positive rate, safe-abstention rate and decision coverage include counts. Undefined ratios are `null`, never 100%. Unknown predictions for positive labels count as missed detections. Unknown-evidence cases have a separate abstention score. Scores are grouped by family; the report explicitly marks production accuracy as unknown and independent DBA review as false.

This is a development corpus, not an unseen evaluation set. Next: independently label anonymized cast, spill, estimate and index-coverage plans, separating plan-only and context-assisted cases. Keep a held-out corpus and reviewer disagreement records before publishing any real-world accuracy claim.

This is not the same as real-world root-cause accuracy. A production percentage is **not established** because the project does not yet have an independent, DBA-labelled benchmark corpus with agreed expected findings.

## Accuracy benchmark required

For every anonymized plan, independent reviewers should record the primary symptom, evidence-supported hypotheses, unsafe conclusions, required missing context, and the controlled validation step. Measure:

- finding precision: reported findings judged correct / all reported findings;
- finding recall: expected findings detected / all expected findings;
- unsafe-claim rate: unsupported causal claims / all claims;
- top-priority agreement: cases where the first investigation matches the reviewer consensus;
- evidence calibration: observed, derived, suspected, unknown, and verified labels used correctly.

Do not publish a percentage until the corpus covers PostgreSQL versions, read/write plans, joins, partitioning, parallelism, spills, estimate drift, casts, index-only scans, parameter skew, and incomplete captures. Report confidence intervals and disagreements, not only one aggregate score.
