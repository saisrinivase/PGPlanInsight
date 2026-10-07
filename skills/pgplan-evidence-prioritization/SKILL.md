---
name: pgplan-evidence-prioritization
description: "Use when changing how PGPlan Insight ranks findings, selects an operation, or chooses a next investigation from PostgreSQL plan evidence. Preserve exact attribution, uncertainty, and safe-abstention behavior."
---

# PGPlan Evidence Prioritization

Use this workflow when tuning finding selection or ordering in the analyzer, Findings workspace, report export, or plan navigation.

## Rules

- Rank only candidates that independently satisfy the finding's existing evidence threshold. Do not weaken thresholds to produce a recommendation.
- Keep ranking evidence local to the candidate operation. Prefer directly measured quantities such as rows removed multiplied by loops; use captured reads or time only as tie-breakers when present.
- Never describe a ranking proxy as elapsed-time contribution, causality, or guaranteed benefit. Inclusive node time contains descendant work; buffer counters can count repeated accesses.
- Carry the chosen operation's exact plan path from analysis to UI and report. Do not reconstruct attribution from finding titles or choose a different node later.
- If candidates cannot be distinguished from available evidence, disclose that limitation instead of inventing confidence.
- Preserve alternatives, healthy controls, incomplete-evidence cases, and safe abstention.

## Validation loop

1. Add a regression plan with at least two qualifying operations in reverse tree-versus-evidence order.
2. Assert that selection follows the declared evidence ordering and retains the exact path through Findings, PEV2 navigation, and report export.
3. Add a healthy or incomplete-evidence control that must not produce the finding.
4. Run focused unit and browser tests; then run the relevant broader suite.
5. Treat synthetic fixtures as regression conformance only. Diagnostic accuracy requires independent DBA-labelled cases and real-user review.

Record the selected ranking signals, tie-breaks, unknowns, test evidence, and remaining validation needs. Do not push or claim production accuracy from this skill.