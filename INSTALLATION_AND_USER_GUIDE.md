# PGPlan Insight v0.6.0 — Installation and User Guide

PGPlan Insight is a browser-local PostgreSQL execution-plan diagnostic tool. The core application has no Java backend and does not upload plans.

## 1. Requirements and quick start

Requirements: Node.js 24, npm, and a current desktop browser. The downloaded ZIP does not contain `node_modules`. After extracting it, open PowerShell in the folder containing `package.json` and install the locked dependencies:

```powershell
cd "$HOME\Downloads\PGPlanInsight-main"
npm ci
npm run dev -- --host 127.0.0.1 --port 5176
```

Open `http://127.0.0.1:5176/` and leave the terminal running while using the app. Stop the server with `Ctrl+C`. If the extracted folder has a suffix such as `(1)`, use its actual name. If you cloned the repository, change to the clone's root instead.

On macOS or Linux, use Terminal and the same commands from the repository root:

```bash
cd /path/to/PGPlanInsight
npm ci
npm run dev
```

Open the local URL printed by Vite. Keep the terminal process running and stop it with `Ctrl+C`.

## 2. Production build and deployment

```bash
cd /path/to/PGPlanInsight
npm ci
npm run test
npm run build
```

The deployable static application is generated in `dist/`. Do not open `dist/index.html` directly with a `file://` URL; serve the directory through HTTPS or a local HTTP server.

Deploy the complete contents of `dist/` to a static HTTPS host such as an internal Nginx/Apache server, Cloudflare Pages, Netlify, Vercel, or GitHub Pages. No application server or database connection is required.

Recommended enterprise deployment:

1. Run all automated tests and build the release.
2. Publish `dist/` to an internal HTTPS origin.
3. Preserve the Content Security Policy in `index.html`.
4. Confirm browser storage is allowed for the site so local case history works.
5. Do not add analytics or remote APIs without updating the privacy model.

`127.0.0.1` is accessible only on the computer running the server. Other users need a hosted HTTPS URL or their own local installation.

## 3. Capture a useful PostgreSQL plan

Use representative parameter values and capture where safe:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)
SELECT ...;
```

`ANALYZE` executes the statement before the plan is pasted into PGPlan Insight, including writes. Use a safe environment, appropriate privileges, and a statement timeout. Rollback cannot undo every side effect.

The app accepts PostgreSQL `FORMAT JSON` and standard PostgreSQL TEXT. JSON usually carries more structured evidence. Remove secrets or sensitive literal values before sharing plans or exported reports.

## 4. Analyze a plan

Before loading an individual plan, **Prioritize workload** can import the sanitized `pg_stat_statements` snapshot format. It ranks cumulative counters from the supplied snapshot and can start an investigation for a selected fingerprint. It does not establish latency percentiles, root cause, or fix benefit. The included read-only collector is [pgplan-workload-snapshot.sql](public/pgplan-workload-snapshot.sql); inspect its output before importing.

1. Optionally enter a case name and choose whether to save it. Plans are not saved by default.
2. Paste plan TEXT/JSON, choose a local `.txt` or `.json` file, or drop a file into the input area. **Sample plans** provides local diagnostic and scale examples.
3. Select **Analyze plan**. Analysis is performed in the browser; no database connection is made.
4. Review the six workspaces: **Plan**, **Findings**, **Planner diagnostics**, **Validate fix**, **Database context**, and **Plan reference**.
5. In Plan, PEV2 provides **Plan**, **Grid**, **Raw**, **Query**, and **Stats** modes. Select a node to inspect available details and navigate to it from a related finding when an exact operation is known.
6. Use the header switch to choose Dark or Light appearance. The selection is saved in that browser profile.

## 5. Interpret evidence

Read each investigation as a chain from captured evidence to a bounded next test:

- **Observed** means directly captured in the plan or imported context.
- **Derived** means calculated from captured evidence, such as actual-versus-planned row drift.
- **Suspected** means a possible cause that still needs testing.
- **Unknown** identifies evidence not present in this plan or context pack.
- **Verified** means a bounded comparison passed its evidence checks; it does not guarantee improvement across a workload or production environment.

Start with measured time, rows, loops, filtering, heap fetches, buffers, and direct temporary-block evidence. `Actual Rows` is generally per loop; read it with `Actual Loops`. Node timings and parent buffer totals are inclusive of descendants, so do not add parent and child values together. Planner cost is a comparison estimate, not milliseconds. A sequential scan is not automatically bad, and an index scan is not automatically cheap.

Findings are prioritized review signals, not promised speedups. Follow an available operation link, check what is measured versus inferred, and use the suggested next step to test one hypothesis. Missing evidence should remain unknown rather than be filled in by assumption.

## 6. Validate a change

1. Make one controlled change outside PGPlan Insight.
2. Capture an after-plan with comparable SQL shape, representative parameters, settings, cache/concurrency conditions, and repeated executions where practical.
3. Open **Validate fix**, complete the capture comparability declarations, paste the after-plan, and run the comparison gate.
4. Treat declarations as operator-provided, not plan-verified facts. A single faster run or missing runtime/evidence is not sufficient proof of improvement.

The comparison uses captured runtime and structural evidence. It does not approve a production change or prove workload-wide benefit.
After a comparison, **Export validation report** downloads a Markdown summary of that comparison and its evidence boundaries.

## 7. Database context and Plan reference

Database context is optional. Generate the sanitized metadata pack using the supplied read-only collection SQL, review its output, then import it in **Database context**. The application does not connect to a database. Context can qualify hypotheses about relations, columns, types, indexes, statistics, partitions, and safe planner settings; it does not establish runtime causality.

The **Plan reference** workspace searches and filters guidance for scans, buffers and I/O, memory, timing, common PostgreSQL data types, casts, operator resolution, and collations. Expand an entry for its meaning, how to read it, what not to infer, and the related official PostgreSQL documentation.

## 8. Reports, history, and appearance

- Plans are not saved by default. Choose 1, 7, or 30 days before analysis to save a plan in this browser profile.
- Use **Plan history** to reopen a saved case, delete one case, or clear all history. Expired cases are removed when history is opened; at most 50 cases are kept.
- The Dark/Light selection is saved separately in browser local storage.

Plan history is local to that browser profile and origin. Changing hostname or port can create a separate storage origin. Saved plans may contain SQL, identifiers, and expressions. Use **Preview redacted plan** before sharing; redaction reduces detail but does not guarantee anonymity.

## 9. Development and release checks

```bash
npm test
npm run build
npm run test:e2e
npm run security:static
```

`npm run release:gate` additionally performs a locked install, synthetic diagnostic scoring, the complete test/build/security checks, online dependency audits, and release artifact verification. The hosted Windows/macOS workflow is the release acceptance gate. Check its status before treating a candidate as approved.

## 10. Troubleshooting

- **Page does not open:** confirm the Vite server is running and use the exact URL it printed.
- **Port already in use:** choose another port with `npm run dev -- --port 5177`.
- **`vite` is not recognized:** run `npm ci` from the repository root. Do not install Vite globally.
- **Plan rejected:** confirm it is PostgreSQL `FORMAT JSON` or standard TEXT containing plan nodes and `cost=` fields.
- **Evidence is incomplete:** recapture with `ANALYZE`, `BUFFERS`, `SETTINGS`, or `WAL` where safe; not every format or PostgreSQL version includes every field.
- **History is missing:** confirm the same browser profile, hostname, and port are being used and site storage was not cleared.
- **Other users cannot connect:** `127.0.0.1` is local-only; deploy `dist/` to an accessible HTTPS origin.

## 11. Privacy boundary

The core application parses, analyzes, stores, and compares plans in the browser. It does not connect to PostgreSQL, execute SQL, or send plan content to an AI provider or external service. Hosting static files does not itself transmit pasted plan contents, but browser extensions, modified deployments, or added telemetry can change that boundary and must be reviewed separately.


## 12. Privacy controls and deployment hardening

Use **Preview redacted plan** before saving sensitive input. It replaces identifiers and removes SQL, expressions, settings and unknown fields, then lets you inspect the JSON before choosing **Use redacted plan**. Metrics remain and can still be sensitive. Redaction reduces diagnostic evidence; it is not a guarantee of anonymity. The original input is unchanged until you accept the preview.

Serve only the built `dist` directory. A sample Nginx configuration is in `deploy/nginx.conf`; configure HTTPS at your reverse proxy. Set CSP `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer` at the actual host. The preview server supplies these headers for tests, but your production host must be verified separately. Do not expose Vite's development server.

The release gate performs its own locked install and online audits. Missing advisory data fails the gate. Standalone artifact generation cannot claim PASS without fresh matching gate evidence. Evidence includes the commit, source hash, lockfile hash, timestamp and both audit reports.

EXPLAIN ANALYZE executes its SQL. Prefer a safe test environment, least privilege and a statement timeout. Transaction rollback cannot undo every side effect (for example sequence advancement or external functions).
