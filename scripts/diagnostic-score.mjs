// Each record is one independently labelled diagnostic decision, not a whole plan.
export function scoreDecisions(records) {
  if (!records.length) throw new Error("Benchmark must not be empty");
  const ids = new Set();
  const counts = { tp: 0, fp: 0, tn: 0, fn: 0, abstentionCases: 0, safeAbstentions: 0 };
  for (const record of records) {
    if (!record.id || ids.has(record.id)) throw new Error("Missing or duplicate benchmark id");
    ids.add(record.id);
    if (!["positive", "negative", "unknown"].includes(record.expected) || !["positive", "negative", "unknown"].includes(record.actual)) throw new Error("Invalid decision label");
    if (record.expected === "unknown") {
      counts.abstentionCases++;
      if (record.actual === "unknown") counts.safeAbstentions++;
    } else if (record.expected === "positive") {
      counts[record.actual === "positive" ? "tp" : "fn"]++;
    } else {
      if (record.actual === "positive") counts.fp++;
      else if (record.actual === "negative") counts.tn++;
    }
  }
  const ratio = (n, d) => d ? n / d : null;
  return { cases: records.length, ...counts,
    precision: ratio(counts.tp, counts.tp + counts.fp),
    recall: ratio(counts.tp, counts.tp + counts.fn),
    falsePositiveRate: ratio(counts.fp, records.filter(r => r.expected === "negative").length),
    safeAbstentionRate: ratio(counts.safeAbstentions, counts.abstentionCases),
    decisionCoverage: ratio(records.filter(r => r.actual !== "unknown").length, records.length),
    mismatches: records.filter(r => r.expected !== r.actual).map(r => r.id) };
}
