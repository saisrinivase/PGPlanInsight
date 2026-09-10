# Statistics, casts, and index-only scans

PGPlan Insight separates captured facts from possible causes. A plan can prove that a row estimate was wrong, a cast was present, or heap fetches occurred. It cannot prove why those facts occurred without the required database context and a controlled before/after test.

## Statistics qualification

- **Observed:** the first row-producing operation with at least 10× Actual Rows versus Plan Rows drift.
- **Suspected:** significant modifications since ANALYZE, or a multicolumn predicate without covering extended statistics, when a sanitized Context Pack supports that hypothesis.
- **Unknown:** statistics freshness, distribution/skew, parameter sensitivity, and causality when context is absent or incomplete.
- **Controlled validation:** change one statistics condition, use the same SQL and representative parameters, and accept the hypothesis only when estimate accuracy and plan/runtime quality improve repeatedly.

Existing extended statistics prevent duplicate advice. Histogram bounds and most-common values are intentionally excluded from the sanitized Context Pack, so a DBA may still need to inspect them directly inside the database boundary.

## Plan-visible type coercion

- **Observed:** a column-expression cast in an index condition, join/filter predicate, or output expression.
- **Suspected:** output coercion below `Append`/`SetOp` may come from `UNION` or `UNION ALL` branch reconciliation; coercion at a context-qualified materialized-view relation may originate in the view definition.
- **Unknown:** which branch, view expression, parameter, or environment introduced the type; whether an ordinary index became unusable; whether the cast materially affected runtime.
- **Controlled validation:** align originating types explicitly, recapture with the same workload, verify that the cast disappears, and pass Fix Validation.

Typed constants such as `'1'::integer` are excluded because they do not by themselves prove that PostgreSQL coerced a column expression. A `bigint` to `double precision` cast also deserves precision review, but the plan alone does not prove that precision was lost.

## Index-only scans

- **Observed:** `Heap Fetches`, residual rows removed by a filter, and zero-heap access when those fields are captured.
- **Derived:** repeated probes are considered material only when captured loops accumulate at least 100 ms or at least 10% of execution time.
- **Unknown:** visibility-map efficiency when `Heap Fetches` is absent, including older saved analyses created before this field was normalized.
- **Controlled validation:** check vacuum/visibility health for heap-fetch-heavy scans, reduce outer-loop probes for loop amplification, and require a comparable after plan.

Estimated cost alone never establishes runtime impact. An index-only scan is not automatically healthy, and high cost does not automatically make it faulty.

## Recommended capture

Use `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT JSON)` when it is safe to execute the statement. Import the sanitized Database Context Pack when statistics or schema qualification is needed. `ANALYZE` executes the SQL, so production-safe judgment remains required.
