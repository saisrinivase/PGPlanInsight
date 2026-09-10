# PGPlan Insight Database Context Pack

The Context Pack qualifies plan-only hypotheses without connecting the browser to PostgreSQL. It is optional; execution-plan analysis continues to work when no pack is imported.

## Collection

Review `public/pgplan-context-pack.sql` before using it. It opens a read-only transaction and queries catalog/statistics views for one schema. It does not read application table rows.

Run from the `pgplan_v0` directory:

```sh
psql -X --no-psqlrc --set=ON_ERROR_STOP=1 --set=target_schema=public --file=public/pgplan-context-pack.sql
```

Replace `public` with the schema needed for the plan. Save or copy only the JSON value printed under `context_pack`, inspect it, and paste it into **Database context → Preview sanitized context**.

## Retained metadata

- Collection time, PostgreSQL version, collector version, and redaction declaration.
- Relation estimates, sizes, analyze timestamps, tuple/activity counters.
- Column names, data types, null fraction, distinct estimate, correlation, and statistics target.
- Index names, key/include columns, access method, size, scan counter, validity, and structural flags.
- Extended-statistics names, involved columns, and kinds—never their value distributions.
- Partition names, strategy, and key columns—never partition-bound literals.
- An allowlist of planner settings relevant to diagnosis.

## Deliberately excluded

Credentials, hosts, database names, owners, role names, SQL/query text, table rows, most-common values, histogram bounds, predicate literals, and expression definitions are excluded. The browser normalizes imports to its allowlisted schema and previews discarded sensitive or unknown fields before application.

## Evidence boundary

Catalog context can qualify whether an index exists, types align, statistics appear stale, extended statistics exist, or a relation is partitioned. It does not prove production causality, concurrency, cache representativeness, lock waits, or that a proposed fix improved runtime. Use a comparable before/after plan for verification.
