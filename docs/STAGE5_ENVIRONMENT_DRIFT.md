# Stage 5 — Environment drift comparison

PGPlan Insight can compare two sanitized Database Context Pack v2 snapshots. The applied pack is the production target; the second imported pack is the PTEST reference.

## Compared evidence

- PostgreSQL version
- relation presence
- column presence and declared types
- index shape, include columns, predicate/expression flags, validity and readiness
- column statistics target, n-distinct, null fraction and correlation
- modifications since analyze
- extended-statistics column/kind coverage
- partition strategy and key coverage
- allowlisted planner settings

An unavailable section is reported as not comparable. It is never converted into a missing-object diagnosis.

## Interpretation boundary

The imported metadata difference is observed. Its possible planning or access-path impact is a bounded hypothesis. Runtime causality remains unknown until the same SQL, representative parameters, comparable settings/cache/concurrency, and repeated before/after plans verify the result.

In particular, a PTEST `bigint` and production `double precision` column mismatch can explain plan-visible implicit casts, changed operator selection, or lost index eligibility, but the snapshot difference alone does not prove it caused elapsed time.

## Security and privacy

Both inputs use the existing sanitized Context Pack parser and 1 MB boundary. Credentials, host/database identifiers, SQL text, statistic values, and unknown fields are not retained. Comparison is browser-local and makes no database or external network connection.

## Verification

- 85 unit tests pass, including positive, exact-match, missing-object, invalid-index, type-coercion, and unavailable-section cases.
- The production build passes.
- The focused comparison workflow passes in Chromium, Firefox, WebKit, mobile Chromium, and mobile WebKit.
- The complete browser suite passes 115 active workflows; 45 retired legacy-renderer tests are intentionally skipped.
- Offline production dependency audit reports zero vulnerabilities.

