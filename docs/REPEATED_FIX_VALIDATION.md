# Repeated-run Fix Validation

Use independent before/after executions for one controlled change. The current before plan and pasted after plan each count as one capture. Choose additional TEXT/JSON files on each side, then run the gate. File selection replaces that side's additional captures. Clear removes additional captures only. Imports are processed in isolated analysis workers; no database connection or external upload is introduced.

Capture groups are temporary for the current Validate fix visit. Export the report before leaving the workspace or reloading; additional captures are not saved in case history.

Limits: 10 captures per side, 10 MB per imported file, 20 MB per file selection. At least three captures on each side and all capture declarations are required for a directional verdict. Reusing the same file does not prove independent executions. Capture independence, SQL equivalence, representative parameters, cache state and concurrency remain operator declarations.

## Reading the result

- Runtime and resource comparisons use per-side medians. All submitted runtimes and their min/max ranges remain visible and exported; no outliers or warm-ups are silently discarded.
- Relative MAD is median absolute deviation divided by the median. MAD above 20%, overlapping ranges for a material runtime change, missing runtime, changed captured settings or changed median returned rows blocks attribution.
- A median runtime change of at least 10% is material. More than a 10% median increase in root shared reads, temp block operations or WAL bytes blocks acceptance until the trade-off is reviewed. Any positive increase from a zero baseline also requires review.
- Missing counters are N/A, not zero. Capture availability is retained separately from normalized numeric counters. Historical saved analyses lacking that metadata remain unknown.
- These thresholds are conservative product screening rules, not statistical significance, confidence intervals, p95 estimates, or DBA-certified diagnostic accuracy. Three samples do not guarantee representativeness.
- Plan-shape variation is flagged. Structural matching uses the median-runtime representative on each side (upper-middle capture for an even count), not a synthetic merged tree. Resource medians do not sum parent/child inclusive counters or imply unique physical reads.
- Locks, telemetry, concurrency, cache effects, causal origin, semantic SQL equivalence and production-wide benefit are not established by these captures.

The Markdown export contains the verdict, all blockers/warnings, median metrics, each runtime, ranges, MAD and these limitations.

## DBA review required before accuracy claims

The automated cases are developer-labelled synthetic regressions. No independent DBA sign-off is claimed. Ask a DBA to independently label anonymized representative capture groups before viewing the tool's verdict, record disagreements and review false-positive improvement claims first.

| Case | Expected screening behavior | Independent DBA review |
|---|---|---|
| One fast after run, declarations checked | Inconclusive; insufficient submitted captures | Pending |
| Stable separated ranges, equivalent rows, reduced runtime/resources | Improved captured runtime; production benefit remains unknown | Pending |
| Faster median but overlapping ranges/high variation | Inconclusive; collect more evidence | Pending |
| Faster runtime with higher reads/temp/WAL | Inconclusive; review resource trade-off | Pending |
| Missing runtime or counters | Block runtime verdict or retain unknown resource evidence | Pending |
| Settings drift, changed result rows, mixed plan shapes | Block comparability or flag representative-tree limitation | Pending |

Record exact app commit, PostgreSQL version, capture process and reviewer decision. Do not replace missing review with automated fixture scores.
