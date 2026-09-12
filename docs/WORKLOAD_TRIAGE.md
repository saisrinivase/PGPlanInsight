# Workload triage

Workload triage answers one question before plan interpretation: **which captured statement consumed the most PostgreSQL execution time?** It does not diagnose the root cause from cumulative counters.

## Collect a sanitized snapshot

1. Confirm that `pg_stat_statements` is already installed and collecting representative activity.
2. Download `pgplan-workload-snapshot.sql` from the Workload Triage screen.
3. Run it with a read-only PostgreSQL account that can read `pg_stat_statements`:

   ```sh
   psql -X -qAt -v ON_ERROR_STOP=1 -f pgplan-workload-snapshot.sql your_database > workload-snapshot.json
   ```

4. Review the JSON before importing it. The supplied collector excludes SQL text, database and user names, hosts, parameters, credentials, and object names. It retains an opaque `queryid` fingerprint and performance counters, which may still be sensitive operational data.
5. Import the JSON in Workload Triage. Processing is browser-local.

The collector is read-only, supports the PostgreSQL 14–18 `pg_stat_statements` catalog surface, aggregates the same query ID across hidden database/user dimensions, and returns at most 5,000 fingerprints. The importer accepts at most 2 MB.

## Interpret the ranking

- **Observed:** PostgreSQL-attributed calls, cumulative execution time, rows, shared blocks, temporary blocks, and WAL bytes.
- **Derived:** each fingerprint's share of captured execution time and its deterministic rank.
- **Primary review:** the strongest available counter-level signal—temporary I/O, physical reads, WAL, mean latency, frequency, or total database time. It is an investigation direction, not a proven cause.
- **Unknown:** p95/p99 latency, concurrency, lock waits, parameter skew, cache state, plan structure, and remediation outcome.

Counters are cumulative since `pg_stat_statements` was reset and may combine different parameter values. Compare equivalent observation windows when evaluating workload change.

## Continue into plan diagnosis

Select **Start investigation** for a fingerprint. PGPlan Insight opens a new plan case labeled with that fingerprint. Obtain the corresponding SQL only within your approved database workflow, then capture a representative plan in a safe environment:

```sql
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, WAL, FORMAT JSON)
-- approved statement here
```

`EXPLAIN ANALYZE` executes the statement. Use appropriate permissions, a statement timeout, representative parameters, and a safe test environment. Workload rank determines what to investigate first; the execution plan provides node-level diagnostic evidence; repeated before/after runs are required to verify a fix.
