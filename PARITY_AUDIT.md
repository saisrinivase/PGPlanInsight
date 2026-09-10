# PGPlan Insight v1.3.1 to React parity audit

Audit date: 2026-08-24
Audited build: `pgplan_v0.2.1`
Role: PostgreSQL DBA / performance-tuning SME

## Release position

The React workbench is functional and accuracy-hardened, but exact v1.3.1 parity is not yet complete. Do not retire the frozen v1.3.1 HTML until the remaining blocked items pass.

## Passed

- React 19 + TypeScript + Vite production build.
- Zod validation at the untrusted JSON boundary.
- Worker-backed analysis for UI responsiveness.
- Light enterprise workbench at desktop and 390px mobile viewport.
- Plan Viewer node tree and inspector.
- Summary and evidence score.
- Plan Tutor derived from the current plan.
- Evidence ledger and captured settings.
- Access Paths, Parallel Workers, Bad Estimates, and Recommendations.
- AI DBA Review produces a sanitized evidence packet and sends nothing.
- IndexedDB history persists until manual clear.
- Fix Validation compares runtime, root reads, root temp blocks, root WAL bytes, node count, and structural node-type shifts.
- Local Markdown validation report generation.
- 12 enterprise pgbench captures validated through the domain engine.
- 15 automated tests pass.
- No browser warnings/errors in the full navigation and comparison workflow.

## Accuracy corrections made during audit

- Empty `Settings: {}` now counts as captured evidence.
- Sub-10ms planning time no longer creates a planning-overhead false positive.
- Broad, low-discard sequential scans no longer automatically create access-path findings.
- High-volume scan filtering requires at least 10,000 removed rows and at least 5x removed-versus-returned rows.
- Correlated rescans are detected from measured loops plus time/read evidence, not a fixed 500-loop threshold.
- Hash spill detail includes measured hash batches.
- Parallel suppression requires the captured setting plus a high-volume scan.
- WAL pressure requires a modifying root and material WAL counters.
- Large OFFSET is detected from Limit child work versus returned rows.
- Root query totals are used for temp, WAL, and buffer comparisons to avoid inclusive parent/child double-counting.

## Enterprise plan gate

1. Healthy primary-key lookup: no false problem.
2. Non-sargable expression: estimate drift + high-volume filtering.
3. Legitimate broad scan: no false access-path problem.
4. Missing history support: high-volume filtering confirmed.
5. Correlated scan: loop amplification confirmed.
6. External sort: spill confirmed.
7. Hash aggregate: spill + 1,365 batches confirmed.
8. Parallel disabled: captured-setting diagnosis confirmed.
9. Forced JIT thresholds: no invented JIT overhead.
10. Rolled-back update: WAL/write pressure confirmed.
11. Expression selectivity: estimate drift confirmed.
12. Large OFFSET: pagination work confirmed.

## Remaining parity blockers

- TEXT-plan parser.
- PEV2 rendering parity and its full navigation modes.
- Exact migration of every v1.3.1 deterministic rule and Plan Tutor lesson.
- Structural node matching that survives inserted/removed branches, rather than path-only matching.
- Bind-sensitive/selective-versus-broad pair classification.
- Full v1.3.1 export report content and case metadata.
- PostgreSQL 17/18 MEMORY and SERIALIZE evidence fields.
- Automated Playwright suite committed to the repository; current browser workflow was run interactively.

## Release decision

`pgplan_v0.2.1` is approved for continued development and SME evaluation. It is not approved as a full replacement for v1.3.1 until the remaining parity blockers pass.
