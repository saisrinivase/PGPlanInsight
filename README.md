# pgplan_v0

Modern modular rebuild of PGPlan Insight. Version `0.5.0` combines the maintained PEV2 execution-plan renderer with PGPlan Insight's deterministic evidence, root-cause tracing, controlled tuning experiments, optional sanitized database context, local case history, and guarded before/after validation.

## Architecture

- React 19 application shell with focused feature components
- Framework-independent TypeScript analysis engine
- Zod validation only at the untrusted plan-input boundary
- Web Worker execution for parsing and deterministic analysis
- Vitest domain-rule coverage
- Official PEV2 1.23 renderer, isolated from the React shell
- Bootstrap styling scoped to the PEV2 surface (no global theme leakage)
- Browser-local analysis with a restrictive Content Security Policy
- No Java backend and no plan upload path
- Temporary analysis by default; optional IndexedDB history with 1/7/30-day retention and individual deletion
- Light enterprise diagnosis workspace

## Run

Full installation, deployment, usage, privacy, and troubleshooting instructions are in [INSTALLATION_AND_USER_GUIDE.md](./INSTALLATION_AND_USER_GUIDE.md).

```bash
npm install
npm run dev
```

## Release gate

Use a locked installation and run the complete local quality/security gate before releasing:

```bash
npm ci
npm run release:gate
```

The gate runs unit tests, a production TypeScript/Vite build, Chromium/Firefox/WebKit desktop and mobile workflows, static secret and unsafe-sink checks, current online production and development dependency advisory audits, license policy, SBOM generation, and SHA-256 artifact hashing. Local evidence is written to `dist/release/`; CI verifies it but does not upload it.

## Primary workflow

1. Paste an `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)` plan.
2. Review the top deterministic diagnosis and its evidence confidence.
3. Use PEV2 **Plan** for the connected tree and metric outline, or **Grid** for dense evidence.
4. Open an evidence finding to see the measured signal and controlled next test.
5. Compare the after plan in **Validate fix**.

## Current capability

- PostgreSQL `FORMAT JSON` intake
- Evidence-quality scoring
- Deterministic primary-signal selection
- Ranked findings with evidence and validation actions
- PEV2 Plan, Grid, Raw, Query, and Stats views
- Proven / suspected / unknown evidence classification
- “Observed at” versus deepest evidenced root-cause tracing
- Experiment prerequisites, success criteria, and rollback boundaries
- Optional browser-session database context for index/column qualification
- Fix Validation comparability blockers for SQL, parameters, settings/environment, and runtime evidence
- Settings and evidence ledger

The primary product surface is **Plan**, **Findings**, **Validate fix**, and **Evidence**. Evidence-specific Access Paths, Parallel Workers, and Bad Estimates are available under **More tools** only when the plan supports them.

Implemented in v0.4: PostgreSQL-version normalization, TEXT-plan parsing, graphical plan rendering, structural Fix Validation matching, committed Playwright workflows, and Markdown/JSON report exports.


### Privacy controls and deployment hardening

Use **Preview redacted plan** before saving sensitive input. It replaces identifiers and removes SQL, expressions, settings and unknown fields, then lets you inspect the JSON before choosing **Use redacted plan**. Metrics remain and can still be sensitive. Redaction reduces diagnostic evidence; it is not a guarantee of anonymity. The original input is unchanged until you accept the preview.

Serve only the built `dist` directory. A sample Nginx configuration is in `deploy/nginx.conf`; configure HTTPS at your reverse proxy. Set CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` at the actual host. The preview server supplies these headers for tests, but your production host must be verified separately. Do not expose Vite's development server.

The release gate performs its own locked install and online audits. Missing advisory data fails the gate. Standalone artifact generation cannot claim PASS without fresh matching gate evidence. Evidence includes the commit, source hash, lockfile hash, timestamp and both audit reports.

EXPLAIN ANALYZE executes its SQL. Prefer a safe test environment, least privilege and a statement timeout. Transaction rollback cannot undo every side effect (for example sequence advancement or external functions).
