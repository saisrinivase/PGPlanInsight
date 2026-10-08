import { useState } from "react";

const topics = ["All", "Scans", "I/O", "Memory", "Timing"] as const;
type Topic = typeof topics[number];

const referenceItems: Array<{ topic: Exclude<Topic, "All">; title: string; meaning: string; read: string; caution: string; source: string; href: string }> = [
  {
    topic: "Scans",
    title: "Sequential scan",
    meaning: "Reads the relation's pages and tests rows against the node's filter. It can be the cheapest choice for a small table or a query that returns a large share of rows.",
    read: "Compare rows removed with rows returned, relation size, buffers, and elapsed work. A sequential scan alone is not evidence of a missing index.",
    caution: "A plan does not include the complete workload or prove that another access path would be cheaper.",
    source: "EXPLAIN: scan and filter choices",
    href: "https://www.postgresql.org/docs/current/using-explain.html",
  },
  {
    topic: "Scans",
    title: "Index scan",
    meaning: "Uses an index to find tuple locations, then visits the table heap for row data. An index condition narrows index entries; a separate filter is checked after rows are fetched.",
    read: "Inspect Index Cond, Filter, returned rows, loops, heap-related buffers, and total work together.",
    caution: "Many scattered heap visits can cost more than a sequential read, even when an index is used.",
    source: "EXPLAIN: index scans",
    href: "https://www.postgresql.org/docs/current/using-explain.html",
  },
  {
    topic: "Scans",
    title: "Index-only scan and Heap Fetches",
    meaning: "The index can provide requested columns, but PostgreSQL may still visit the heap to verify tuple visibility. Heap Fetches counts those visits in the captured execution.",
    read: "Compare Heap Fetches with row visits and loops. Lower heap fetches can indicate more benefit from the index-only path.",
    caution: "Heap Fetches is not a count of all table I/O. Visibility-map coverage and vacuum state are database context, not proven by this node alone.",
    source: "EXPLAIN ANALYZE: index-only scans",
    href: "https://www.postgresql.org/docs/current/using-explain.html#USING-EXPLAIN-ANALYZE",
  },
  {
    topic: "Scans",
    title: "Bitmap Index Scan and Bitmap Heap Scan",
    meaning: "The index scan gathers matching tuple locations into a bitmap; the heap scan visits relevant table pages, often in physical order. Multiple bitmap indexes may be combined.",
    read: "Read the bitmap index child with its heap parent. Check exact/lossy heap blocks and rows removed by index recheck when present.",
    caution: "Do not assess the bitmap index child as if it fetched the table rows by itself.",
    source: "EXPLAIN: bitmap scans",
    href: "https://www.postgresql.org/docs/current/using-explain.html",
  },
  {
    topic: "Scans",
    title: "Rows Removed by Filter",
    meaning: "Rows (or candidate join pairs) rejected by a filter at that node. For repeated nodes, PostgreSQL reports per-loop row counts; multiply by Actual Loops for an approximate total rejected count.",
    read: "Compare rejected rows with returned rows and inspect the predicate and node type to see where filtering occurs.",
    caution: "High filtering does not prove an index is appropriate: selectivity, relation size, existing indexes, and workload matter.",
    source: "EXPLAIN ANALYZE: rows removed by filter",
    href: "https://www.postgresql.org/docs/current/using-explain.html#USING-EXPLAIN-ANALYZE",
  },
  {
    topic: "I/O",
    title: "Buffers: hit and read",
    meaning: "A hit means the requested block was already in PostgreSQL shared buffers. A read means PostgreSQL had to load it into shared buffers.",
    read: "Use node and root buffer counts to locate where this execution accessed blocks; shared read counts are not elapsed I/O time.",
    caution: "A shared-buffer read does not prove a physical device read; the operating-system cache may satisfy it. Parent-node buffer counts include child work.",
    source: "EXPLAIN BUFFERS option",
    href: "https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-PARAMETERS",
  },
  {
    topic: "I/O",
    title: "Buffers: dirtied and written",
    meaning: "Dirtied counts previously clean shared blocks changed by the query. Written counts dirty blocks the backend wrote out while processing the query.",
    read: "Review writes with dirtied blocks, WAL, query type, and checkpoint context; compare repeated representative captures.",
    caution: "Written blocks are not a direct measurement of storage-device writes or write latency. Parent counts include child activity.",
    source: "EXPLAIN BUFFERS option",
    href: "https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-PARAMETERS",
  },
  {
    topic: "I/O",
    title: "Temporary blocks and spill evidence",
    meaning: "Temporary blocks are short-term work data used by operations such as sorts, hashes, and materialization. Read and written counts show temp-block activity captured for the plan.",
    read: "Find the sort/hash or other operator with direct temp counters, then inspect sort method, hash batches, and node time.",
    caution: "Root temporary counters are inclusive. They may not identify which child spilled; do not attribute them to a node without direct evidence.",
    source: "EXPLAIN BUFFERS option",
    href: "https://www.postgresql.org/docs/current/sql-explain.html#SQL-EXPLAIN-PARAMETERS",
  },
  {
    topic: "I/O",
    title: "I/O timing",
    meaning: "When track_io_timing is enabled, EXPLAIN BUFFERS can report time spent in block reads and writes.",
    read: "Use timing with buffer counts to distinguish access volume from measured wait time.",
    caution: "Timing is unavailable unless collected; zero or missing timing is not proof that storage had no latency.",
    source: "I/O timing configuration",
    href: "https://www.postgresql.org/docs/current/runtime-config-statistics.html#GUC-TRACK-IO-TIMING",
  },
  {
    topic: "Memory",
    title: "work_mem and hash_mem_multiplier",
    meaning: "work_mem is a base limit per sort or hash operation before temporary files may be used. A query can have several such operations, and concurrent sessions and parallel workers multiply total memory use.",
    read: "Use captured work_mem as context, then review the plan's actual sort/hash memory, batches, temp blocks, worker count, concurrency, and server memory budget.",
    caution: "The plan does not report a safe cluster-wide work_mem value. Raising it can multiply memory demand and cause memory pressure.",
    source: "Resource consumption: work_mem",
    href: "https://www.postgresql.org/docs/current/runtime-config-resource.html#GUC-WORK-MEM",
  },
  {
    topic: "Memory",
    title: "Sort and hash memory",
    meaning: "Sort nodes can report sort method and memory or disk usage. Hash nodes can report buckets, batches, and memory usage.",
    read: "A disk-based sort or multiple hash batches is direct evidence of that operation's execution behavior; check temp-block counters and node loops too.",
    caution: "One node's reported memory is not the query's peak total memory or the server's concurrent memory demand.",
    source: "EXPLAIN ANALYZE: sort and hash details",
    href: "https://www.postgresql.org/docs/current/using-explain.html#USING-EXPLAIN-ANALYZE",
  },
  {
    topic: "Timing",
    title: "Actual time and loops",
    meaning: "Node actual times are milliseconds per execution; rows are average rows per loop. Multiply per-loop values by Actual Loops for approximate totals.",
    read: "Use loops to understand repeated work. Compare a node with its children and the statement execution time.",
    caution: "Node times are inclusive of descendants, so adding parent and child times double-counts work. EXPLAIN ANALYZE also has measurement overhead.",
    source: "EXPLAIN ANALYZE: actual rows, loops, and time",
    href: "https://www.postgresql.org/docs/current/using-explain.html#USING-EXPLAIN-ANALYZE",
  },
  {
    topic: "Timing",
    title: "Planner cost and estimated rows",
    meaning: "Cost is a planner comparison unit, not milliseconds. Plan Rows is the estimated output row count; it is not necessarily the number of rows examined.",
    read: "Compare Plan Rows with Actual Rows at corresponding nodes. Large divergence can affect join order and access-path choices.",
    caution: "Cost depends on planner settings and estimates; it does not establish measured runtime contribution.",
    source: "Using EXPLAIN: interpreting estimates and cost",
    href: "https://www.postgresql.org/docs/current/using-explain.html",
  },
];

export function PlanReferenceView() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic>("All");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = referenceItems.filter((item) => {
    if (topic !== "All" && item.topic !== topic) return false;
    return !normalizedQuery || `${item.title} ${item.meaning} ${item.read} ${item.caution} ${item.source}`.toLocaleLowerCase().includes(normalizedQuery);
  });

  return <section className="workspace-panel plan-reference" aria-labelledby="plan-reference-title">
    <header className="reference-heading">
      <div>
        <div className="section-kicker">PostgreSQL field guide</div>
        <h2 id="plan-reference-title">Plan reference</h2>
        <p className="lede">Quickly interpret common plan fields, see what they can support, and open the matching official PostgreSQL documentation when you need depth.</p>
      </div>
      <label className="reference-search"><span>Search reference</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try heap fetches, shared read, work_mem…" /></label>
    </header>

    <div className="reference-toolbar">
      <div className="reference-filters" role="group" aria-label="Filter reference topics">
        {topics.map((item) => <button type="button" key={item} aria-pressed={topic === item} className={topic === item ? "active" : ""} onClick={() => setTopic(item)}>{item}</button>)}
      </div>
      <p aria-live="polite">{filtered.length} reference{filtered.length === 1 ? "" : "s"}</p>
    </div>

    <div className="reference-results">
      {filtered.map((item) => <article className="reference-entry" key={item.title}>
        <header><span>{item.topic}</span><h3>{item.title}</h3></header>
        <dl>
          <div><dt>Meaning</dt><dd>{item.meaning}</dd></div>
          <div><dt>How to read it</dt><dd>{item.read}</dd></div>
          <div className="reference-caution"><dt>Do not infer</dt><dd>{item.caution}</dd></div>
        </dl>
        <a href={item.href} target="_blank" rel="noreferrer">{item.source}<span aria-hidden="true"> ↗</span></a>
      </article>)}
      {filtered.length === 0 && <p className="reference-empty">No reference matches that search. Try a field name such as “Buffers”, “Heap Fetches”, or “work_mem”.</p>}
    </div>

    <aside className="reference-source-note"><strong>Version note</strong><span>PostgreSQL documentation links follow the current official manual. Terminology and available fields can vary by server version; use the documentation version matching your database when details differ.</span><a href="https://www.postgresql.org/docs/">Choose a PostgreSQL documentation version ↗</a></aside>
  </section>;
}
