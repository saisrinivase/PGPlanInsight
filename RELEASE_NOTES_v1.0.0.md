# PGPlan Insight v1.0.0

## Scope

- Browser-local PostgreSQL TEXT/JSON execution-plan analysis with PEV2 v1.25.0 Plan, Grid, Raw, Query and Stats views. Includes upstream HashAggregate batch parsing, never-executed-node and tree/tab-layout fixes.
- Evidence-led Findings and Planner diagnostics for access paths, estimates, loop amplification, visible casts, heap fetches and temporary I/O.
- Sanitized Database Context Pack, environment comparison and guarded candidate-index experiments. No SQL execution or direct database connection.
- Repeated-run Fix Validation: 3–10 captures per side for directional screening, median runtime/resources, variability checks and report export. Missing evidence stays explicit; captures are temporary for the current validation visit.
- Workload triage, plan reference, optional browser-local saved cases and light/dark appearance.

## Validation and publication

The product owner reports internal acceptance by DBAs and developers. The v1.0.0 preparation passed 154 unit tests and 156 desktop browser tests (27 retired tests skipped), production build, static checks, current dependency audits, license/SBOM generation and artifact verification. Vite was updated within its supported range to resolve advisory findings.

Hosted Windows/macOS CI must pass on the exact published commit before creating the production tag. See [Actions](https://github.com/saisrinivase/PGPlanInsight/actions/workflows/release-gate.yml); a version string alone does not establish publication. Desktop Chromium, Firefox and WebKit are the release browser matrix; Linux and mobile are excluded.

## Limits and operator responsibilities

No independent real-world diagnostic-accuracy percentage is established. Index candidates and causal explanations remain bounded hypotheses; plan-only evidence cannot prove cache effects, locks, concurrency or production-wide benefit. Repeated-run screening is not statistical significance or p95 estimation.

Configure and verify HTTPS/security headers at the deployment origin, review sensitive plans before sharing, confirm rights-holder authorization and follow change control. The existing large-bundle warning remains. Security checks are not a guarantee of zero vulnerabilities.

Deploy only the generated `dist/` contents and retain matching release evidence. See [README](README.md), [security guidance](SECURITY.md) and [license](LICENSE).

## Credits

Sai (@saisrinivase), project owner; Codex, AI-assisted development/testing. Plan visualization uses Dalibo PEV2; bundled third-party terms remain applicable.
