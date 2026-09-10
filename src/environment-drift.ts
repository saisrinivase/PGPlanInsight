import type { ContextColumn, ContextIndex, ContextRelation, ContextSection, DatabaseContext } from "./database-context.ts";

export type DriftArea = "version" | "relation" | "column-type" | "index" | "statistics" | "extended-statistics" | "partition" | "setting";
export type DriftSeverity = "critical" | "warning" | "info";

export interface EnvironmentDrift {
  id: string;
  area: DriftArea;
  severity: DriftSeverity;
  object: string;
  referenceValue: string;
  targetValue: string;
  observed: string;
  hypothesis: string;
  nextAction: string;
}

export interface EnvironmentDriftReport {
  referenceVersion: string;
  targetVersion: string;
  comparedRelations: number;
  differences: EnvironmentDrift[];
  counts: Record<DriftSeverity, number>;
  conclusion: string;
}

const key = (relation: Pick<ContextRelation, "schema" | "name">) => `${relation.schema}.${relation.name}`.toLowerCase();
const displayKey = (relation: Pick<ContextRelation, "schema" | "name">) => `${relation.schema}.${relation.name}`;
const columnMap = (relation: ContextRelation) => new Map(relation.columns.map((column) => [column.name.toLowerCase(), column]));
const indexShape = (index: ContextIndex) => `${index.accessMethod ?? "btree"}(${index.columns.map((item) => item.toLowerCase()).join(",")}) include(${(index.includeColumns ?? []).map((item) => item.toLowerCase()).join(",")})${index.hasPredicate ? " partial" : ""}${index.hasExpressions ? " expression" : ""}`;
const extendedShape = (relation: ContextRelation) => new Set((relation.extendedStatistics ?? []).map((item) => `${item.columns.map((column) => column.toLowerCase()).sort().join(",")}:${[...item.kinds].sort().join(",")}`));
const partitionShape = (relation: ContextRelation) => new Set((relation.partitions ?? []).map((item) => `${item.strategy ?? "unknown"}:${(item.keyColumns ?? []).map((column) => column.toLowerCase()).join(",")}`));
const value = (input: number | undefined) => input == null ? "not captured" : String(input);
const ratioDrift = (left: number | undefined, right: number | undefined, floor = 0) => left != null && right != null && Math.max(left, right) >= floor && Math.max(left, right) / Math.max(1, Math.min(Math.abs(left), Math.abs(right))) >= 2;
const comparable = (reference: DatabaseContext, target: DatabaseContext, section: ContextSection) => reference.availability[section].status === "captured" && target.availability[section].status === "captured";

function make(area: DriftArea, severity: DriftSeverity, object: string, referenceValue: string, targetValue: string, observed: string, hypothesis: string, nextAction: string): EnvironmentDrift {
  return { id: `${area}:${object}`.toLowerCase(), area, severity, object, referenceValue, targetValue, observed, hypothesis, nextAction };
}

function compareColumn(relation: string, reference: ContextColumn, target: ContextColumn, differences: EnvironmentDrift[]) {
  const object = `${relation}.${reference.name}`;
  if (reference.type.toLowerCase() !== target.type.toLowerCase()) differences.push(make(
    "column-type", "critical", object, reference.type, target.type,
    `Reference declares ${reference.type}; target declares ${target.type}.`,
    "Different types can introduce implicit casts, change operator/index eligibility, or alter UNION/view expression resolution.",
    "Inspect the view/UNION output type and plan predicates; align the declared expression type, then compare a new plan.",
  ));
  const stats: Array<[keyof ContextColumn, string]> = [["statisticsTarget", "statistics target"], ["nDistinct", "n-distinct estimate"], ["nullFraction", "null fraction"], ["correlation", "correlation"]];
  for (const [field, label] of stats) if (ratioDrift(reference[field] as number | undefined, target[field] as number | undefined, field === "statisticsTarget" ? 1 : 0)) differences.push(make(
    "statistics", "warning", `${object} · ${label}`, value(reference[field] as number | undefined), value(target[field] as number | undefined),
    `${label} differs materially between the imported snapshots.`,
    "The planner may estimate selectivity or access cost differently; this metadata alone does not prove stale statistics.",
    "Check ANALYZE recency and representative data distribution, refresh targeted statistics if justified, then compare estimates.",
  ));
}

export function compareDatabaseEnvironments(reference: DatabaseContext, target: DatabaseContext): EnvironmentDriftReport {
  const differences: EnvironmentDrift[] = [];
  const referenceRelations = new Map(reference.relations.map((relation) => [key(relation), relation]));
  const targetRelations = new Map(target.relations.map((relation) => [key(relation), relation]));
  if (reference.provenance.postgresVersion !== target.provenance.postgresVersion) differences.push(make("version", "info", "PostgreSQL version", reference.provenance.postgresVersion, target.provenance.postgresVersion, "Server versions differ.", "Planner behavior and available statistics can differ by PostgreSQL version.", "Review release-note planner changes and reproduce with identical SQL and settings."));
  const sectionAreas: Array<[ContextSection, DriftArea]> = [["relationStats", "relation"], ["columnStats", "column-type"], ["indexStats", "index"], ["extendedStats", "extended-statistics"], ["partitions", "partition"], ["settings", "setting"]];
  for (const [section, area] of sectionAreas) if (!comparable(reference, target, section)) differences.push(make(area, "info", `${section} coverage`, reference.availability[section].status, target.availability[section].status, "This metadata section is unavailable in one or both snapshots.", "No environment difference can be inferred for this section.", "Collect the same sanitized section in both environments before comparing it."));

  for (const [relationKey, referenceRelation] of referenceRelations) {
    const targetRelation = targetRelations.get(relationKey);
    const relation = displayKey(referenceRelation);
    if (!targetRelation) { differences.push(make("relation", "critical", relation, "present", "missing", "Relation exists only in the reference snapshot.", "The compared environments may not represent the same schema deployment.", "Verify schema/version selection before interpreting plan differences.")); continue; }
    const referenceColumns = columnMap(referenceRelation), targetColumns = columnMap(targetRelation);
    if (comparable(reference, target, "columnStats")) {
      for (const [columnName, referenceColumn] of referenceColumns) {
        const targetColumn = targetColumns.get(columnName);
        if (!targetColumn) differences.push(make("column-type", "critical", `${relation}.${referenceColumn.name}`, referenceColumn.type, "missing", "Column exists only in the reference snapshot.", "Queries or views may resolve to a different schema shape.", "Confirm the deployed DDL before comparing plans."));
        else compareColumn(relation, referenceColumn, targetColumn, differences);
      }
      for (const targetColumn of targetRelation.columns) if (!referenceColumns.has(targetColumn.name.toLowerCase())) differences.push(make("column-type", "warning", `${relation}.${targetColumn.name}`, "missing", targetColumn.type, "Column exists only in the target snapshot.", "Schema drift may change view expansion or query semantics.", "Confirm whether the deployment difference is intentional."));
    }

    if (comparable(reference, target, "indexStats")) {
      const referenceIndexes = new Map(referenceRelation.indexes.map((index) => [indexShape(index), index]));
      const targetIndexes = new Map(targetRelation.indexes.map((index) => [indexShape(index), index]));
      for (const [shape, index] of referenceIndexes) if (!targetIndexes.has(shape)) differences.push(make("index", "warning", `${relation}.${index.name}`, shape, "missing", "Reference index shape is not present in target metadata.", "The target planner may lack an equivalent access path.", "Verify validity and deployed DDL; test an equivalent index with HypoPG or a controlled environment before production DDL."));
      for (const [shape, index] of targetIndexes) if (!referenceIndexes.has(shape)) differences.push(make("index", "info", `${relation}.${index.name}`, "missing", shape, "Target has an index shape absent from reference.", "Different index choices may be expected; scan counts do not prove usefulness.", "Compare chosen access paths and measured buffers under representative parameters."));
      for (const index of targetRelation.indexes) if (index.valid === false || index.ready === false) differences.push(make("index", "critical", `${relation}.${index.name}`, "not compared", `valid=${index.valid ?? "unknown"}, ready=${index.ready ?? "unknown"}`, "Target index is not valid or not ready.", "PostgreSQL may be unable to use this index as expected.", "Inspect index build state and repair through the approved operational procedure."));
    }

    if (comparable(reference, target, "extendedStats")) for (const shape of extendedShape(referenceRelation)) if (!extendedShape(targetRelation).has(shape)) differences.push(make("extended-statistics", "warning", relation, shape, "missing", "Reference extended-statistics coverage is absent from target.", "Multi-column selectivity estimates may diverge for correlated predicates.", "Confirm the affected predicate columns; create and ANALYZE statistics only in a controlled test first."));
    if (comparable(reference, target, "partitions")) for (const shape of partitionShape(referenceRelation)) if (!partitionShape(targetRelation).has(shape)) differences.push(make("partition", "warning", relation, shape, "missing", "Reference partition strategy/key coverage is absent from target.", "Partition pruning and scanned data volume may differ.", "Verify deployed partition DDL and pruning evidence in the target plan."));
    if (comparable(reference, target, "relationStats") && ratioDrift(referenceRelation.modificationsSinceAnalyze, targetRelation.modificationsSinceAnalyze, 1000)) differences.push(make("statistics", "warning", `${relation} · modifications since analyze`, value(referenceRelation.modificationsSinceAnalyze), value(targetRelation.modificationsSinceAnalyze), "Modification counters differ materially.", "Target statistics may represent a different data-change state; the counter alone does not prove staleness.", "Compare last analyze time and modification rate, then run targeted ANALYZE only if operationally appropriate."));
  }
  for (const targetRelation of target.relations) if (!referenceRelations.has(key(targetRelation))) differences.push(make("relation", "warning", displayKey(targetRelation), "missing", "present", "Relation exists only in the target snapshot.", "The environments may not represent the same deployed schema.", "Confirm schema/version selection before comparing plans."));

  if (comparable(reference, target, "settings")) {
    const referenceSettings = new Map(reference.settings.map((setting) => [setting.name, setting.value]));
    const targetSettings = new Map(target.settings.map((setting) => [setting.name, setting.value]));
    for (const setting of new Set([...referenceSettings.keys(), ...targetSettings.keys()])) {
      const left = referenceSettings.get(setting) ?? "not captured", right = targetSettings.get(setting) ?? "not captured";
      if (left !== right) differences.push(make("setting", "warning", setting, left, right, "Safe planner setting differs or is unavailable in one snapshot.", "Costing, memory, parallelism, or pruning decisions may differ.", "Reproduce with an intentionally comparable setting scope; do not change a global setting from this comparison alone."));
    }
  }
  const counts = { critical: differences.filter((item) => item.severity === "critical").length, warning: differences.filter((item) => item.severity === "warning").length, info: differences.filter((item) => item.severity === "info").length };
  return { referenceVersion: reference.provenance.postgresVersion, targetVersion: target.provenance.postgresVersion, comparedRelations: [...referenceRelations.keys()].filter((item) => targetRelations.has(item)).length, differences, counts, conclusion: differences.length ? `${differences.length} metadata difference(s) observed. These qualify hypotheses; they do not prove the cause of a runtime regression.` : "No difference was found in the captured, allowlisted metadata. Uncaptured workload and runtime conditions can still differ." };
}
