# pgplan_v0.4.0

## First-use value

- Replaced the generic paste-form landing page with a working PostgreSQL plan-analysis canvas.
- Added one-click analysis of a real spill plan so users can evaluate the product without supplying data.
- Added local JSON/TEXT file selection and drag-and-drop intake.
- Added a visible diagnosis and execution-tree preview.
- Applied a PostgreSQL-native `#336791` blue color system.

## Plan analysis

- Added deterministic PostgreSQL TEXT plan parsing.
- Added normalization for clipboard plans whose lines are individually quoted and whose identifiers contain escaped underscores.
- Added `Parallel Seq Scan` filtering detection using per-loop removed-row evidence.
- Added canonical adapters for known PostgreSQL field variations and worker arrays.
- Added PostgreSQL-major and adapter metadata to normalized analysis.
- Added a graphical execution tree with connectors, risk markers, heat, node selection, and list fallback.
- Added a pinned DBA assessment separating the likely mechanism, measured evidence, causes not indicated by the capture, and facts requiring catalog/workload confirmation.
- Added total-row flow and per-loop row/worker context to graphical nodes.
- Replaced the initial graph with an execution-flow tree: upward data direction, row-volume connector weight, focused ancestor path, inclusive/self timing, estimate drift, and collapsible subtrees.

## Validation and reporting

- Replaced path-only before/after matching with scored structural node matching.
- Added Markdown and normalized JSON analysis exports.
- Added adapter and match-confidence details to Fix Validation reports.

## Verification

- 20 domain tests pass across 12 enterprise pgbench cases, standard/quoted TEXT parsing, version normalization, and structural comparison.
- Eight Playwright workflows pass in desktop Chrome and mobile Chrome.
- TypeScript and Vite production build pass.
- npm audit reports zero vulnerabilities.

## Accuracy boundary

TEXT parsing supports standard PostgreSQL EXPLAIN layouts and deliberately rejects arbitrary text. FORMAT JSON remains the recommended evidence format. Recommendations remain controlled experiments requiring representative before/after proof.
