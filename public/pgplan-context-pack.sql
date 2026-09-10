\set ON_ERROR_STOP on
\if :{?target_schema}
\else
  \set target_schema 'public'
\endif

-- PGPlan Insight Context Pack v2
-- Supported/tested catalog surface: PostgreSQL 14–18.
-- Read-only and least-privilege: queries public/system catalog metadata only.
-- Deliberately excludes table rows, SQL text, hosts, database names, roles,
-- credentials, most-common values, histogram bounds, and predicate literals.

BEGIN TRANSACTION READ ONLY;

WITH relation_base AS (
  SELECT c.oid AS relid, n.nspname AS schema_name, c.relname,
         CASE c.relkind WHEN 'p' THEN 'partitioned-table' WHEN 'm' THEN 'materialized-view' ELSE 'table' END AS kind,
         c.reltuples::float8 AS row_estimate,
         pg_relation_size(c.oid)::float8 AS size_bytes,
         pg_total_relation_size(c.oid)::float8 AS total_size_bytes,
         s.n_live_tup::float8 AS live_tuples, s.n_dead_tup::float8 AS dead_tuples,
         s.n_mod_since_analyze::float8 AS modifications_since_analyze,
         s.last_analyze, s.last_autoanalyze,
         s.seq_scan::float8 AS sequential_scans, s.idx_scan::float8 AS index_scans
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_all_tables s ON s.relid = c.oid
  WHERE n.nspname = :'target_schema' AND c.relkind IN ('r','p','m')
), column_json AS (
  SELECT rb.relid, jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
           'nullFraction', ps.null_frac, 'nDistinct', ps.n_distinct,
           'correlation', ps.correlation, 'statisticsTarget', NULLIF(a.attstattarget, -1)
         )) ORDER BY a.attnum) AS columns
  FROM relation_base rb
  JOIN pg_attribute a ON a.attrelid = rb.relid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_stats ps ON ps.schemaname = rb.schema_name AND ps.tablename = rb.relname AND ps.attname = a.attname
  GROUP BY rb.relid
), index_rows AS (
  SELECT i.indrelid AS relid, ic.relname AS index_name, am.amname AS access_method,
         pg_relation_size(ic.oid)::float8 AS size_bytes, si.idx_scan::float8 AS scans,
         i.indisunique, i.indisprimary, i.indisvalid, i.indisready,
         i.indpred IS NOT NULL AS has_predicate, i.indexprs IS NOT NULL AS has_expressions,
         ARRAY(SELECT a.attname FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
               WHERE k.ord <= i.indnkeyatts AND k.attnum > 0 ORDER BY k.ord) AS key_columns,
         ARRAY(SELECT a.attname FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
               JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
               WHERE k.ord > i.indnkeyatts AND k.attnum > 0 ORDER BY k.ord) AS include_columns
  FROM pg_index i
  JOIN relation_base rb ON rb.relid = i.indrelid
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_am am ON am.oid = ic.relam
  LEFT JOIN pg_stat_all_indexes si ON si.indexrelid = i.indexrelid
), index_json AS (
  SELECT relid, jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'name', index_name, 'columns', to_jsonb(key_columns), 'includeColumns', to_jsonb(include_columns),
           'accessMethod', access_method, 'sizeBytes', size_bytes, 'scans', scans,
           'unique', indisunique, 'primary', indisprimary, 'valid', indisvalid, 'ready', indisready,
           'hasPredicate', has_predicate, 'hasExpressions', has_expressions
         )) ORDER BY index_name) AS indexes
  FROM index_rows GROUP BY relid
), extended_json AS (
  SELECT e.stxrelid AS relid, jsonb_agg(jsonb_build_object(
           'name', e.stxname,
           'columns', (SELECT jsonb_agg(a.attname ORDER BY k.ord)
                       FROM unnest(e.stxkeys::smallint[]) WITH ORDINALITY k(attnum, ord)
                       JOIN pg_attribute a ON a.attrelid = e.stxrelid AND a.attnum = k.attnum),
           'kinds', (SELECT jsonb_agg(CASE kind WHEN 'd' THEN 'ndistinct' WHEN 'f' THEN 'dependencies' WHEN 'm' THEN 'mcv' END)
                     FROM unnest(e.stxkind) AS k(kind))
         ) ORDER BY e.stxname) AS extended_statistics
  FROM pg_statistic_ext e JOIN relation_base rb ON rb.relid = e.stxrelid GROUP BY e.stxrelid
), partition_json AS (
  SELECT parent.oid AS relid, jsonb_agg(jsonb_build_object(
           'schema', child_ns.nspname, 'name', child.relname,
           'strategy', CASE pt.partstrat WHEN 'r' THEN 'range' WHEN 'l' THEN 'list' WHEN 'h' THEN 'hash' END,
           'keyColumns', (SELECT COALESCE(jsonb_agg(a.attname ORDER BY k.ord), '[]'::jsonb)
                          FROM unnest(pt.partattrs::smallint[]) WITH ORDINALITY k(attnum, ord)
                          JOIN pg_attribute a ON a.attrelid = parent.oid AND a.attnum = k.attnum)
         ) ORDER BY child_ns.nspname, child.relname) AS partitions
  FROM relation_base rb
  JOIN pg_class parent ON parent.oid = rb.relid
  JOIN pg_partitioned_table pt ON pt.partrelid = parent.oid
  JOIN pg_inherits inh ON inh.inhparent = parent.oid
  JOIN pg_class child ON child.oid = inh.inhrelid
  JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
  GROUP BY parent.oid
), safe_settings AS (
  SELECT jsonb_agg(jsonb_build_object('name', name, 'value', setting) ORDER BY name) AS settings
  FROM pg_settings
  WHERE name IN ('default_statistics_target','effective_cache_size','enable_partition_pruning','max_parallel_workers_per_gather','random_page_cost','seq_page_cost','work_mem')
), relation_json AS (
  SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'schema', rb.schema_name, 'name', rb.relname, 'kind', rb.kind,
           'rowEstimate', rb.row_estimate, 'sizeBytes', rb.size_bytes, 'totalSizeBytes', rb.total_size_bytes,
           'liveTuples', rb.live_tuples, 'deadTuples', rb.dead_tuples,
           'modificationsSinceAnalyze', rb.modifications_since_analyze,
           'lastAnalyze', rb.last_analyze, 'lastAutoAnalyze', rb.last_autoanalyze,
           'sequentialScans', rb.sequential_scans, 'indexScans', rb.index_scans,
           'columns', COALESCE(cj.columns, '[]'::jsonb), 'indexes', COALESCE(ij.indexes, '[]'::jsonb),
           'extendedStatistics', COALESCE(ej.extended_statistics, '[]'::jsonb),
           'partitions', COALESCE(pj.partitions, '[]'::jsonb)
         )) ORDER BY rb.schema_name, rb.relname) AS relations
  FROM relation_base rb
  LEFT JOIN column_json cj ON cj.relid = rb.relid
  LEFT JOIN index_json ij ON ij.relid = rb.relid
  LEFT JOIN extended_json ej ON ej.relid = rb.relid
  LEFT JOIN partition_json pj ON pj.relid = rb.relid
)
SELECT jsonb_pretty(jsonb_build_object(
  'version', 2,
  'provenance', jsonb_build_object('collectedAt', clock_timestamp(), 'postgresVersion', current_setting('server_version'), 'collector', 'pgplan-context-sql', 'collectorVersion', '2', 'redacted', true),
  'availability', jsonb_build_object(
    'relationStats', jsonb_build_object('status','captured'), 'columnStats', jsonb_build_object('status','captured'),
    'indexStats', jsonb_build_object('status','captured'), 'extendedStats', jsonb_build_object('status','captured'),
    'partitions', jsonb_build_object('status','captured'), 'settings', jsonb_build_object('status','captured')),
  'settings', COALESCE((SELECT settings FROM safe_settings), '[]'::jsonb),
  'relations', COALESCE((SELECT relations FROM relation_json), '[]'::jsonb)
)) AS context_pack;

ROLLBACK;
