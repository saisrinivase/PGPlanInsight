\set ON_ERROR_STOP on

-- PGPlan Insight Workload Snapshot v1
-- PostgreSQL 14-18; requires pg_stat_statements.
-- Read-only and deliberately excludes SQL text, users, database names, hosts,
-- parameter values, credentials, and object names. Query ID is an opaque
-- fingerprint used to correlate a selected statement outside this tool.

BEGIN TRANSACTION READ ONLY;

WITH aggregated AS (
  SELECT queryid::text AS fingerprint, sum(calls)::float8 AS calls,
         sum(total_exec_time)::float8 AS total_exec_time_ms,
         CASE WHEN sum(calls) > 0 THEN (sum(total_exec_time) / sum(calls))::float8 ELSE 0 END AS mean_exec_time_ms,
         sum(rows)::float8 AS rows, sum(shared_blks_hit)::float8 AS shared_hit_blocks,
         sum(shared_blks_read)::float8 AS shared_read_blocks,
         sum(temp_blks_read)::float8 AS temp_read_blocks,
         sum(temp_blks_written)::float8 AS temp_written_blocks,
         sum(wal_bytes)::float8 AS wal_bytes
  FROM pg_stat_statements
  WHERE queryid IS NOT NULL
  GROUP BY queryid
), ranked AS (
  SELECT * FROM aggregated
  ORDER BY total_exec_time_ms DESC, fingerprint
  LIMIT 5000
), payload AS (
  SELECT jsonb_agg(jsonb_build_object(
    'fingerprint', fingerprint, 'calls', calls,
    'totalExecTimeMs', total_exec_time_ms, 'meanExecTimeMs', mean_exec_time_ms,
    'rows', rows, 'sharedHitBlocks', shared_hit_blocks,
    'sharedReadBlocks', shared_read_blocks, 'tempReadBlocks', temp_read_blocks,
    'tempWrittenBlocks', temp_written_blocks, 'walBytes', wal_bytes
  ) ORDER BY total_exec_time_ms DESC, fingerprint) AS statements FROM ranked
)
SELECT jsonb_pretty(jsonb_build_object(
  'version', 1,
  'provenance', jsonb_build_object(
    'collectedAt', clock_timestamp(), 'postgresVersion', current_setting('server_version'),
    'statsResetAt', (SELECT stats_reset FROM pg_stat_statements_info),
    'collector', 'pgplan-workload-sql', 'redacted', true
  ),
  'statements', COALESCE((SELECT statements FROM payload), '[]'::jsonb)
)) AS workload_snapshot;

ROLLBACK;
