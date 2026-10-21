# PGPlan Insight

<img src="public/pgplan-logo.svg" alt="PGPlan Insight PG monogram" width="80" height="80">

**An evidence-first PostgreSQL plan review workspace for DBAs, developers, and database architects.** Paste an execution plan, inspect measured work, follow findings to relevant plan operations, and validate a proposed change with a comparable after-plan.

[![PGPlan Insight release gate](https://github.com/saisrinivase/PGPlanInsight/actions/workflows/release-gate.yml/badge.svg)](https://github.com/saisrinivase/PGPlanInsight/actions/workflows/release-gate.yml)

> **Version 1.0.0.** Internal pilot acceptance by DBAs and developers was reported by the product owner. Check the [release notes](RELEASE_NOTES_v1.0.0.md) and [live Windows/macOS release gates](https://github.com/saisrinivase/PGPlanInsight/actions/workflows/release-gate.yml) for publication status. Pilot acceptance is not a diagnostic-accuracy percentage or endpoint security certification. Rights-holder authority and deployment-origin HTTP header verification remain operator responsibilities.

## About

**Contributors:** [Sai (@saisrinivase)](https://github.com/saisrinivase) · Codex (AI-assisted development and testing). Human maintainers review and approve releases.

PGPlan Insight analyzes PostgreSQL `EXPLAIN` output locally in your browser. It combines the PEV2 plan renderer with deterministic diagnostics and separates captured facts, derived signals, hypotheses, and conclusions that still require validation.

It does not connect to a database, execute SQL, upload plans, or send plan content to an AI service. Optional case history is stored in the browser profile you choose.

## Workflow

Before analyzing a single plan, **Prioritize workload** can import a sanitized `pg_stat_statements` snapshot and rank fingerprints by captured cumulative execution time. It does not include SQL text or establish root cause, p95 latency, or which change will help.

1. **Plan** — inspect the execution tree and metrics in PEV2 Plan, Grid, Raw, Query, and Stats views.
2. **Findings** — review ranked evidence, uncertainty, controlled next tests, and available operation links.
3. **Planner diagnostics** — review access-path work and row-estimate drift, with links to matching plan operations.
4. **Validate fix** — compare repeated before/after captures using median runtime, variability and resource guardrails; missing comparability evidence blocks a confident verdict. See [capture instructions and limits](docs/REPEATED_FIX_VALIDATION.md).
5. **Database context** — optionally import a sanitized metadata pack to qualify catalog and planner hypotheses. No database connection is made.
6. **Plan reference** — search explanations for scans, heap fetches, buffers, temporary I/O, timing, `work_mem`, PostgreSQL types, casts, operators, and collations, with cautions and links to the official PostgreSQL manual.

## Quick Start

Requirements: Node.js 24 and npm. A downloaded ZIP does not contain `node_modules`. Install dependencies from the extracted repository root before starting Vite.

**Windows PowerShell**

```powershell
cd "$HOME\Downloads\PGPlanInsight-main"
npm ci
npm run dev -- --host 127.0.0.1 --port 5176
```

If your extracted folder has a different name or is not nested, adjust the `cd` path so it opens the folder containing `package.json`. Run `npm ci` once after extracting the ZIP (the ZIP does not contain `node_modules`), then open `http://127.0.0.1:5176/`. Keep PowerShell open while using the local server; stop it with `Ctrl+C`.

**macOS**

```bash
cd /path/to/PGPlanInsight
npm ci
npm run dev -- --host 127.0.0.1 --port 5176
```

Open the local URL printed by Vite. For installation, plan capture, privacy, deployment, and troubleshooting, see the [Installation and User Guide](INSTALLATION_AND_USER_GUIDE.md).

## Capture a Useful Plan

For detailed runtime evidence, capture a representative execution with:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)
SELECT ...;
```

`ANALYZE` executes the statement, including writes. Use a safe test environment, suitable privileges, and a statement timeout. A transaction rollback cannot undo every side effect.

The tool also accepts standard PostgreSQL TEXT plans, but some evidence may be unavailable. Planner cost is a relative estimate, not milliseconds. Node actual time and buffer counts are generally inclusive of descendants. `Actual Rows` is reported per loop, so interpret it with `Actual Loops`; do not add parent and child times as if they were independent.

## How to Interpret a Plan

Start with captured execution evidence, not the most alarming operator name or planner cost. Use the six analysis workspaces in order, and treat every proposed change as a hypothesis until a comparable after-plan supports it.

1. **Plan:** select a node and inspect actual and planned rows, loops, time, buffers, filters, heap fetches, temporary blocks, and predicates when captured. PEV2's Plan, Grid, Raw, Query, and Stats modes are alternate views of the same input, not separate diagnoses.
2. **Findings:** open the highest-priority investigation and trace it to its supporting operation where available. Separate what was captured from rule-derived signals, possible causes, unknowns, and after-plan verification. A severity or rank is a review priority, not a guaranteed performance gain.
3. **Planner diagnostics:** review measured access-path contribution and the deepest relevant row-estimate divergence. Cost explains planner comparison choices; actual work explains this captured execution.
4. **Database context:** optionally import a reviewed, sanitized Context Pack to qualify catalog hypotheses. It adds metadata; it does not prove runtime causality, workload recurrence, or production benefit.
5. **Validate fix:** compare one controlled change with a representative after-plan. Confirm comparable SQL shape, representative parameters, settings/environment, and repeated results. Operator declarations are not independently verified by the plan.
6. **Plan reference:** search field/type explanations and their cautions when a plan term, cast, operator, or collation is unfamiliar.

The evidence labels mean:

- **Observed:** directly present in the captured plan or imported context.
- **Derived:** calculated deterministically from captured evidence, such as an estimate ratio.
- **Suspected:** a plausible explanation to test, not an established cause.
- **Unknown:** evidence needed to support a stronger conclusion was not captured or imported.
- **Verified:** a bounded before/after comparison met its stated evidence checks. It is not a guarantee of workload-wide or production improvement.

## Interpretation Boundaries

- A sequential scan is not automatically a problem; consider relation size, selectivity, returned rows, filtering, and measured work.
- Index use does not guarantee low cost. Heap visits, loops, and surrounding joins can dominate.
- Buffer reads do not prove physical device reads; the operating-system cache may satisfy them. Missing I/O timing is not proof of zero wait.
- `work_mem` is a base limit per eligible operation, not a query-wide or server-wide memory budget. Concurrent operations, sessions, and parallel workers can multiply demand.
- Temporary I/O should be attributed to the node that reports it. Root counters may include descendant work.
- Findings are signals and hypotheses, not causal proof. Test one change and compare representative plans before accepting a tuning decision.

## Contributors and Acknowledgments

- **Project owner:** [@saisrinivase](https://github.com/saisrinivase). Product decisions, review, and release responsibility remain with the project owner.
- **Plan visualization:** PGPlan Insight uses [PEV2](https://github.com/dalibo/pev2) v1.23.0. Thank you to [Dalibo](https://dalibo.com/) and the PEV2 contributors for this open-source PostgreSQL plan visualizer. PEV2 is distributed under the PostgreSQL License; required notice text is included in the shipped [third-party notices](public/THIRD_PARTY_NOTICES.md).
- **Development assistance:** GitHub Copilot and OpenAI Codex were used as AI-assisted development tools. Their suggestions were reviewed and verified by the project owner. They are not application features, runtime dependencies, or services that receive user plans.

Diagnostic rules are deterministic but have not been independently validated against a representative DBA-labelled corpus; see [Diagnostic Accuracy Status](docs/DIAGNOSTIC_ACCURACY.md). Synthetic regression scores measure conformance to authored examples, not production accuracy.

## Project License

First-party PGPlan Insight code uses the [PostgreSQL License](LICENSE), permitting use, copying, modification, and distribution for any purpose, provided the required copyright and license notices are preserved. Bundled dependencies and assets retain their own terms; see [third-party notices](public/THIRD_PARTY_NOTICES.md). The release package includes the locked production dependency license inventory and available license texts. This repository audit does not establish legal ownership or substitute for review by the relevant rights holder.

## Disclaimer

PGPlan Insight is provided **as is, without warranty**. Findings are investigation aids, not production-change approval or guaranteed performance improvements. Validate results independently, use a safe test environment, maintain backups, and apply your organization's change-control procedures. Capturing `EXPLAIN ANALYZE` executes the supplied statement, including writes; PGPlan Insight itself executes no SQL.

To the extent permitted by applicable law, the PostgreSQL License disclaims warranties and liability for direct, indirect, special, incidental, or consequential damages, including lost profits, arising from use of the software and its documentation. See [LICENSE](LICENSE) for the controlling terms. This summary does not override applicable law or provide legal advice.

## Privacy and Deployment

Analysis runs in the browser. Plans are temporary by default; if you opt to save one, it stays in that browser profile and may contain SQL, identifiers, and expressions. Use **Preview redacted plan** before saving or sharing sensitive evidence. Redaction reduces detail but does not guarantee anonymity.

For shared use, build and serve the static `dist/` output from an HTTPS host. No application backend is required. Configure and verify response security headers at the hosting origin; a sample is in [deploy/nginx.conf](deploy/nginx.conf). See the [Installation and User Guide](INSTALLATION_AND_USER_GUIDE.md) for deployment details.

## Production package

Supported release targets are Windows and macOS with desktop Chromium, Firefox and WebKit. Linux and mobile are not in the V1 release validation matrix.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run release:gate
```

After a successful gate, deploy the **contents of `dist/`**, not the source repository. The build cleans prior output and generates compiled assets plus `dist/release/` evidence: release report, dependency SBOM, license inventory and SHA-256 manifest. Verify with `node scripts/verify-release-artifacts.mjs`. Registry access is needed for installation and current advisory audits.

Do not deploy `node_modules/`, `src/`, `tests/`, development fixtures, or local test reports. These remain useful in the source repository for maintenance and reproducible verification. Vite's development server is for local development, not a shared production host. Keep the release evidence with the matching build; rebuilding invalidates earlier evidence.

## Development and Release Checks

```bash
npm ci
npm test
npm run build
npm run test:e2e
npm run security:static
```

The full release gate also performs online dependency audits, license and release-artifact checks, and desktop Chromium, Firefox, and WebKit tests on Windows and macOS. Mobile-browser validation is outside the release scope:

```bash
npm run release:gate
```

The hosted release gate must pass on the exact v1.0.0 commit before publishing its tag; follow the [live Actions page](https://github.com/saisrinivase/PGPlanInsight/actions).
