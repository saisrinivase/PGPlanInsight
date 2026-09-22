# Controlled candidate-index experiments

PGPlan Insight treats index advice as a hypothesis to test, not as production DDL to run.

## Evidence boundary

The supplied plan can show a sequential scan, its predicate, and captured reads, rows, loops, and timing. The tool derives candidate keys only from plain predicate columns, ordering equality keys before range keys. It rejects `OR` and expression predicates because safe index semantics cannot be inferred from them.

A plan cannot establish existing indexes, column types, representative selectivity, workload frequency, write rate, table growth, operator classes, partial predicates, or expression-index semantics. A plan-only candidate is therefore **Low confidence**.

Importing a sanitized Database Context Pack enables relation, column, duplicate, and overlap checks. A candidate reaches **Medium confidence** only when context confirms its relation and columns and contains no matching or overlapping leading keys. Runtime benefit remains unverified.

## Safe validation

1. Confirm representative SQL, parameters, settings, cache state, and concurrency.
2. Review predicate evidence, key order, overlap status, and write/storage risks.
3. Resolve duplicate, overlap, missing-relation, or missing-column blockers.
4. Optionally use the displayed HypoPG call in an approved PostgreSQL session.
5. Run `EXPLAIN` without `ANALYZE` and confirm whether the planner chooses the hypothetical shape.
6. Reset the session with `SELECT hypopg_reset();`.
7. If a physical non-production test is separately approved, compare repeated before/after plans and workload telemetry.

HypoPG does not prove runtime improvement because it does not build or execute through a physical index.

Success requires representative planner adoption, fewer reads or filtered rows in a controlled physical test, repeated runtime improvement, and no material write, WAL, storage, lock, or concurrency regression. Reset HypoPG after planning tests. Remove only an explicitly approved test index if the physical-test gates fail; PGPlan Insight never executes that change.

Candidate analysis remains local in the browser. No database connection, credential, dependency, or outbound request is introduced. Existing input validation and size limits remain in force, and evidence is rendered as text.
# Evidence-qualified physical test SQL

Findings offers sample `CREATE INDEX ... USING btree` SQL only for a schema-qualified, context-qualified candidate. Matching existing indexes, overlaps, unavailable inventory, and plan-only evidence withhold the physical SQL. HypoPG controls in this view follow the same qualification boundary. No SQL is executed by the browser.

The statement is for a DBA-reviewed non-production test: regular index creation can block writes. Runtime benefit remains unknown; no speedup percentage is inferred from planner cost. Imported snapshots do not prove operator-class/collation compatibility, selectivity, current catalog state, or workload impact.
