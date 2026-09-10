# PGPlan Insight v0.5 — Installation and User Guide

PGPlan Insight is a browser-local PostgreSQL execution-plan diagnostic tool. The core application has no Java backend and does not upload plans.

## 1. Quick start on this Mac

Open Terminal and run:

```bash
cd /Users/saiendla/Desktop/PGPlaninsight/pgplan_v0
npm install
npm run dev -- --host 127.0.0.1 --port 5175
```

Open `http://127.0.0.1:5175/` in Chrome, Edge, Firefox, or Safari. Keep the Terminal process running while using the development server. Stop it with `Control+C`.

Requirements: Node.js 20 or newer, npm, and a current Chrome, Edge, Firefox, or Safari browser.

## 2. Production build

```bash
cd /Users/saiendla/Desktop/PGPlaninsight/pgplan_v0
npm install
npm run test
npm run build
```

The deployable static application is generated in `dist/`. Do not open `dist/index.html` directly with a `file://` URL; serve the directory through HTTPS or a local HTTP server.

## 3. Making the tool available to other users

Deploy the complete contents of `dist/` to a static HTTPS host such as an internal Nginx/Apache server, Cloudflare Pages, Netlify, Vercel, or GitHub Pages. No application server or database connection is required.

Recommended enterprise deployment:

1. Run all automated tests and build the release.
2. Publish `dist/` to an internal HTTPS origin.
3. Preserve the Content Security Policy in `index.html`.
4. Confirm browser storage is allowed for the site so local case history works.
5. Do not add analytics or remote APIs without updating the privacy model.

`127.0.0.1` is accessible only on the computer running the server. Other users need a hosted HTTPS URL or their own local installation.

## 4. Capturing a high-quality PostgreSQL plan

Use a representative parameter value and capture:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)
SELECT ...;
```

`ANALYZE` executes the statement. Use production-safe judgment, especially for INSERT, UPDATE, DELETE, long-running queries, locks, and high-load systems. Capture write statements in a safe transaction or non-production environment when appropriate.

PGPlan Insight accepts:

- PostgreSQL `FORMAT JSON` — recommended because it carries the most reliable structured evidence.
- Standard PostgreSQL TEXT plans containing `cost=...` nodes — supported for convenience, with less complete evidence than JSON.
- Clipboard TEXT where every line is wrapped in double quotes and underscores are backslash-escaped — normalized locally before parsing.

Remove secrets or sensitive literal values before sharing exported reports.

## 5. Analyzing a plan

1. Open the application.
2. Optionally enter a case title.
3. Paste the JSON or TEXT plan into **Plan evidence**.
4. Select **Analyze and save**.
5. Review the compact evidence findings above the plan.
6. Use PEV2 **Plan** for the connected execution tree and metric outline.
7. Use **Grid** for the dense node table; use **Raw** and **Stats** for source and plan-level metrics.
8. Select PEV2 nodes to inspect their timing, rows, loops, estimate drift, buffers, temporary blocks, predicates, and node-specific details.

Timing is inclusive: parent timing normally contains child work. Approximate self time is provided to reduce incorrect hotspot conclusions.

## 6. Understanding the diagnosis

Every finding has a stable evidence ID and three parts:

- **Diagnosis** — the threshold crossed by captured evidence.
- **Why this is credible** — the measured fields supporting the finding.
- **Safest next test** — a controlled experiment, not an automatic production command.

The tool intentionally does not claim that every sequential scan is bad or that an index is always the correct fix. Accept a change only after representative before/after validation.

## 7. Fix Validation

1. Keep the original slow plan open.
2. Apply one controlled query, index, statistics, memory, or configuration experiment.
3. Capture a new plan with equivalent parameters and environment.
4. Open **Validate fix**.
5. Paste the after plan and select **Compare plans**.

The verdict uses runtime thresholds and also compares root reads, temporary blocks, WAL, node count, and structurally matched access-path changes. A missing runtime produces an inconclusive verdict.

## 8. Navigation

The stable workflow has four direct destinations:

- **Plan** — PEV2 visualization plus PGPlan Insight evidence findings.
- **Findings** — deterministic diagnoses and guarded index experiments.
- **Validate fix** — before/after evidence comparison.
- **Evidence** — captured fields, quality, and diagnostic ledger.
- **Context** — optional sanitized relation, column, index, size, and statistics evidence. No database connection is created.

Open **More tools** for Access Paths, Parallel Workers, and Bad Estimates. Only tools supported by the current plan are shown.

Fix Validation requires declarations that the SQL shape, representative parameters, and execution environment are comparable. Captured setting conflicts or missing runtime evidence block an improvement/regression verdict. A single execution remains a warning until repeated.

The AI DBA view prepares a sanitized local packet only. It sends nothing unless a future user-configured integration is explicitly added.

## 9. Reports and history

- **Export Markdown** creates a DBA-readable report.
- **Export JSON** creates a machine-readable normalized analysis.
- Fix Validation can export its comparison report.
- Saved execution plans remain in browser IndexedDB until **Clear all history** is selected.

Browser history is local to that browser profile and origin. Changing the hostname or port can create a separate browser-storage origin.

## 10. Verification commands

```bash
npm test
npm run test:e2e
npm run build
```

`npm test` runs deterministic domain rules. `npm run test:e2e` runs desktop Chrome, Firefox, Safari/WebKit, Android Chrome, and mobile Safari workflows. `npm run build` verifies the production TypeScript/Vite build.

## 11. Troubleshooting

- **Page does not open:** confirm the Terminal server is still running and use the exact displayed URL.
- **Port already in use:** choose another port, for example `--port 5176`.
- **Plan rejected:** confirm it is valid PostgreSQL FORMAT JSON or a standard TEXT plan beginning with a node containing `cost=`.
- **Weak evidence score:** recapture with ANALYZE, BUFFERS, SETTINGS, and WAL where safe.
- **History missing:** confirm the same browser profile, hostname, and port are being used and site storage was not cleared.
- **Other users cannot connect:** `127.0.0.1` is local-only; deploy `dist/` to an accessible HTTPS host.

## 12. Privacy boundary

The core application parses, analyzes, stores, and compares plans in the browser. There is no Java backend and no required remote API. Hosting the static files does not itself transmit pasted plan contents back to the host, but browser extensions, modified deployments, or added telemetry can change that boundary and must be reviewed separately.
