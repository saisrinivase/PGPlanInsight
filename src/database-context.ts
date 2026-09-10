export type ContextSection = "relationStats" | "columnStats" | "indexStats" | "extendedStats" | "partitions" | "settings";
export type ContextAvailability = Record<ContextSection, { status: "captured" | "unavailable"; reason?: string }>;

export interface ContextColumn {
  name: string;
  type: string;
  nullFraction?: number;
  nDistinct?: number;
  correlation?: number;
  statisticsTarget?: number;
}

export interface ContextIndex {
  name: string;
  columns: string[];
  includeColumns?: string[];
  accessMethod?: string;
  sizeBytes?: number;
  scans?: number;
  unique?: boolean;
  primary?: boolean;
  valid?: boolean;
  ready?: boolean;
  hasPredicate?: boolean;
  hasExpressions?: boolean;
}

export interface ContextExtendedStatistic { name: string; columns: string[]; kinds: Array<"dependencies" | "ndistinct" | "mcv"> }
export interface ContextPartition { schema: string; name: string; strategy?: "range" | "list" | "hash"; keyColumns?: string[] }

export interface ContextRelation {
  schema: string;
  name: string;
  kind?: "table" | "partitioned-table" | "materialized-view";
  rowEstimate?: number;
  sizeBytes?: number;
  totalSizeBytes?: number;
  liveTuples?: number;
  deadTuples?: number;
  modificationsSinceAnalyze?: number;
  lastAnalyze?: string;
  lastAutoAnalyze?: string;
  sequentialScans?: number;
  indexScans?: number;
  columns: ContextColumn[];
  indexes: ContextIndex[];
  extendedStatistics?: ContextExtendedStatistic[];
  partitions?: ContextPartition[];
}

export interface ContextProvenance {
  collectedAt: string;
  postgresVersion: string;
  collector: "pgplan-context-sql" | "manual" | "legacy-v1";
  collectorVersion: string;
  redacted: true;
}

export interface DatabaseContext {
  version: 2;
  provenance: ContextProvenance;
  availability: ContextAvailability;
  settings: Array<{ name: string; value: string }>;
  relations: ContextRelation[];
}

export interface ContextImportPreview {
  sourceVersion: 1 | 2;
  relationCount: number;
  columnCount: number;
  indexCount: number;
  extendedStatisticCount: number;
  partitionCount: number;
  settingsCount: number;
  capturedSections: ContextSection[];
  unavailableSections: ContextSection[];
  discardedFields: string[];
  warnings: string[];
}

export interface ContextImportResult { context: DatabaseContext; preview: ContextImportPreview }

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_RELATIONS = 500;
const MAX_COLUMNS_PER_RELATION = 500;
const MAX_INDEXES_PER_RELATION = 250;
const MAX_EXTENDED_STATS_PER_RELATION = 100;
const MAX_PARTITIONS_PER_RELATION = 2_000;
const MAX_IDENTIFIER_LENGTH = 256;
const SAFE_SETTINGS = new Set(["default_statistics_target", "effective_cache_size", "enable_partition_pruning", "max_parallel_workers_per_gather", "random_page_cost", "seq_page_cost", "work_mem"]);
const SECTIONS: ContextSection[] = ["relationStats", "columnStats", "indexStats", "extendedStats", "partitions", "settings"];

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown, label: string) => { if (value == null) return undefined; if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`); return value; };
const boundedString = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  const result = value.trim();
  if (result.length > MAX_IDENTIFIER_LENGTH) throw new Error(`${label} exceeds ${MAX_IDENTIFIER_LENGTH} characters.`);
  if (/\u0000/.test(result)) throw new Error(`${label} contains an invalid null character.`);
  return result;
};
const optionalTimestamp = (value: unknown, label: string) => {
  if (value == null) return undefined;
  const result = boundedString(value, label);
  if (Number.isNaN(Date.parse(result))) throw new Error(`${label} must be an ISO timestamp.`);
  return result;
};
const boundedArray = (value: unknown, label: string, maximum: number) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > maximum) throw new Error(`${label} contains more than ${maximum} entries.`);
  return value;
};
const stringArray = (value: unknown, label: string, maximum = MAX_COLUMNS_PER_RELATION) => boundedArray(value, label, maximum).map((item, index) => boundedString(item, `${label}[${index}]`));

function parseAvailability(value: unknown, sourceVersion: 1 | 2): ContextAvailability {
  if (sourceVersion === 1) return Object.fromEntries(SECTIONS.map((section) => [section, { status: section === "relationStats" || section === "columnStats" || section === "indexStats" ? "captured" : "unavailable", reason: section === "relationStats" || section === "columnStats" || section === "indexStats" ? undefined : "Legacy v1 context did not capture this section." }])) as ContextAvailability;
  if (!object(value)) throw new Error("availability must describe every Context Pack section.");
  return Object.fromEntries(SECTIONS.map((section) => {
    const item = value[section];
    if (!object(item) || (item.status !== "captured" && item.status !== "unavailable")) throw new Error(`availability.${section}.status must be captured or unavailable.`);
    return [section, { status: item.status, reason: typeof item.reason === "string" ? item.reason.slice(0, 500) : undefined }];
  })) as ContextAvailability;
}

function parseColumn(value: unknown, path: string): ContextColumn {
  if (!object(value)) throw new Error(`${path} must be an object.`);
  return { name: boundedString(value.name, `${path}.name`), type: boundedString(value.type, `${path}.type`), nullFraction: finite(value.nullFraction, `${path}.nullFraction`), nDistinct: finite(value.nDistinct, `${path}.nDistinct`), correlation: finite(value.correlation, `${path}.correlation`), statisticsTarget: finite(value.statisticsTarget, `${path}.statisticsTarget`) };
}

function parseIndex(value: unknown, path: string): ContextIndex {
  if (!object(value)) throw new Error(`${path} must be an object.`);
  return {
    name: boundedString(value.name, `${path}.name`), columns: stringArray(value.columns, `${path}.columns`),
    includeColumns: value.includeColumns == null ? undefined : stringArray(value.includeColumns, `${path}.includeColumns`),
    accessMethod: value.accessMethod == null ? undefined : boundedString(value.accessMethod, `${path}.accessMethod`),
    sizeBytes: finite(value.sizeBytes, `${path}.sizeBytes`), scans: finite(value.scans, `${path}.scans`),
    unique: typeof value.unique === "boolean" ? value.unique : undefined, primary: typeof value.primary === "boolean" ? value.primary : undefined,
    valid: typeof value.valid === "boolean" ? value.valid : undefined, ready: typeof value.ready === "boolean" ? value.ready : undefined,
    hasPredicate: typeof value.hasPredicate === "boolean" ? value.hasPredicate : typeof value.predicate === "string" ? true : undefined,
    hasExpressions: typeof value.hasExpressions === "boolean" ? value.hasExpressions : undefined,
  };
}

function parseRelation(value: unknown, index: number): ContextRelation {
  const path = `relations[${index}]`;
  if (!object(value)) throw new Error(`${path} must be an object.`);
  const columns = boundedArray(value.columns, `${path}.columns`, MAX_COLUMNS_PER_RELATION).map((item, itemIndex) => parseColumn(item, `${path}.columns[${itemIndex}]`));
  const indexes = boundedArray(value.indexes, `${path}.indexes`, MAX_INDEXES_PER_RELATION).map((item, itemIndex) => parseIndex(item, `${path}.indexes[${itemIndex}]`));
  const extendedStatistics = value.extendedStatistics == null ? [] : boundedArray(value.extendedStatistics, `${path}.extendedStatistics`, MAX_EXTENDED_STATS_PER_RELATION).map((item, itemIndex): ContextExtendedStatistic => {
    if (!object(item)) throw new Error(`${path}.extendedStatistics[${itemIndex}] must be an object.`);
    const kinds = stringArray(item.kinds, `${path}.extendedStatistics[${itemIndex}].kinds`, 3);
    if (kinds.some((kind) => !["dependencies", "ndistinct", "mcv"].includes(kind))) throw new Error(`${path}.extendedStatistics[${itemIndex}].kinds contains an unsupported kind.`);
    return { name: boundedString(item.name, `${path}.extendedStatistics[${itemIndex}].name`), columns: stringArray(item.columns, `${path}.extendedStatistics[${itemIndex}].columns`), kinds: kinds as ContextExtendedStatistic["kinds"] };
  });
  const partitions = value.partitions == null ? [] : boundedArray(value.partitions, `${path}.partitions`, MAX_PARTITIONS_PER_RELATION).map((item, itemIndex): ContextPartition => {
    if (!object(item)) throw new Error(`${path}.partitions[${itemIndex}] must be an object.`);
    const strategy = item.strategy == null ? undefined : boundedString(item.strategy, `${path}.partitions[${itemIndex}].strategy`);
    if (strategy && !["range", "list", "hash"].includes(strategy)) throw new Error(`${path}.partitions[${itemIndex}].strategy is unsupported.`);
    return { schema: boundedString(item.schema, `${path}.partitions[${itemIndex}].schema`), name: boundedString(item.name, `${path}.partitions[${itemIndex}].name`), strategy: strategy as ContextPartition["strategy"], keyColumns: item.keyColumns == null ? undefined : stringArray(item.keyColumns, `${path}.partitions[${itemIndex}].keyColumns`) };
  });
  const kind = value.kind == null ? undefined : boundedString(value.kind, `${path}.kind`);
  if (kind && !["table", "partitioned-table", "materialized-view"].includes(kind)) throw new Error(`${path}.kind is unsupported.`);
  return {
    schema: boundedString(value.schema, `${path}.schema`), name: boundedString(value.name, `${path}.name`), kind: kind as ContextRelation["kind"],
    rowEstimate: finite(value.rowEstimate, `${path}.rowEstimate`), sizeBytes: finite(value.sizeBytes, `${path}.sizeBytes`), totalSizeBytes: finite(value.totalSizeBytes, `${path}.totalSizeBytes`),
    liveTuples: finite(value.liveTuples, `${path}.liveTuples`), deadTuples: finite(value.deadTuples, `${path}.deadTuples`), modificationsSinceAnalyze: finite(value.modificationsSinceAnalyze, `${path}.modificationsSinceAnalyze`),
    lastAnalyze: optionalTimestamp(value.lastAnalyze, `${path}.lastAnalyze`), lastAutoAnalyze: optionalTimestamp(value.lastAutoAnalyze, `${path}.lastAutoAnalyze`),
    sequentialScans: finite(value.sequentialScans, `${path}.sequentialScans`), indexScans: finite(value.indexScans, `${path}.indexScans`), columns, indexes, extendedStatistics, partitions,
  };
}

function unknownFields(decoded: Record<string, unknown>, sourceVersion: 1 | 2): string[] {
  const allowed = sourceVersion === 1 ? new Set(["version", "capturedAt", "postgresVersion", "relations"]) : new Set(["version", "provenance", "availability", "settings", "relations"]);
  return Object.keys(decoded).filter((key) => !allowed.has(key));
}

function sensitiveFieldPaths(value: unknown, path = "", result: string[] = []): string[] {
  if (result.length >= 100) return result;
  if (Array.isArray(value)) value.forEach((item, index) => sensitiveFieldPaths(item, `${path}[${index}]`, result));
  else if (object(value)) Object.entries(value).forEach(([key, item]) => {
    const next = path ? `${path}.${key}` : key;
    if (/password|secret|token|hostname|host|databaseName|query|sqlText|mostCommonValues|histogramBounds/i.test(key)) result.push(next);
    sensitiveFieldPaths(item, next, result);
  });
  return result;
}

export function inspectDatabaseContext(source: string): ContextImportResult {
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) throw new Error("Database context exceeds the 1 MB safety limit.");
  let decoded: unknown;
  try { decoded = JSON.parse(source); } catch { throw new Error("Database context must be valid JSON."); }
  if (!object(decoded) || (decoded.version !== 1 && decoded.version !== 2)) throw new Error("Expected database context version 1 or 2.");
  const sourceVersion = decoded.version;
  const relations = boundedArray(decoded.relations, "relations", MAX_RELATIONS).map(parseRelation);
  const availability = parseAvailability(decoded.availability, sourceVersion);
  const settings = sourceVersion === 2 ? boundedArray(decoded.settings, "settings", 50).map((item, index) => {
    if (!object(item)) throw new Error(`settings[${index}] must be an object.`);
    const name = boundedString(item.name, `settings[${index}].name`);
    if (!SAFE_SETTINGS.has(name)) throw new Error(`settings[${index}].name is not in the safe planner-setting allowlist.`);
    return { name, value: boundedString(item.value, `settings[${index}].value`) };
  }) : [];
  const provenanceValue = sourceVersion === 2 && object(decoded.provenance) ? decoded.provenance : null;
  if (sourceVersion === 2 && !provenanceValue) throw new Error("provenance is required for context version 2.");
  if (sourceVersion === 2 && provenanceValue!.redacted !== true) throw new Error("provenance.redacted must be true; import only a sanitized Context Pack.");
  const collectedAt = sourceVersion === 2 ? optionalTimestamp(provenanceValue!.collectedAt, "provenance.collectedAt") : undefined;
  if (sourceVersion === 2 && !collectedAt) throw new Error("provenance.collectedAt is required.");
  const provenance: ContextProvenance = sourceVersion === 1 ? {
    collectedAt: typeof decoded.capturedAt === "string" && !Number.isNaN(Date.parse(decoded.capturedAt)) ? decoded.capturedAt : new Date(0).toISOString(),
    postgresVersion: typeof decoded.postgresVersion === "string" ? decoded.postgresVersion : "not-captured", collector: "legacy-v1", collectorVersion: "1", redacted: true,
  } : {
    collectedAt: collectedAt!, postgresVersion: boundedString(provenanceValue!.postgresVersion, "provenance.postgresVersion"),
    collector: provenanceValue!.collector === "pgplan-context-sql" ? "pgplan-context-sql" : "manual", collectorVersion: boundedString(provenanceValue!.collectorVersion, "provenance.collectorVersion"), redacted: true,
  };
  const discardedFields = [...new Set([...unknownFields(decoded, sourceVersion), ...sensitiveFieldPaths(decoded)])];
  const warnings = [...discardedFields.map((field) => `Top-level field '${field}' was discarded.`)];
  if (sourceVersion === 1) warnings.push("Legacy v1 context was normalized; extended statistics, partitions, and settings remain unavailable.");
  if (!/^1[4-8](?:\.|$)/.test(provenance.postgresVersion) && provenance.postgresVersion !== "not-captured") warnings.push(`PostgreSQL ${provenance.postgresVersion} is outside the currently tested 14–18 range.`);
  const context: DatabaseContext = { version: 2, provenance, availability, settings, relations };
  const preview: ContextImportPreview = {
    sourceVersion, relationCount: relations.length, columnCount: relations.reduce((sum, relation) => sum + relation.columns.length, 0), indexCount: relations.reduce((sum, relation) => sum + relation.indexes.length, 0),
    extendedStatisticCount: relations.reduce((sum, relation) => sum + (relation.extendedStatistics?.length ?? 0), 0), partitionCount: relations.reduce((sum, relation) => sum + (relation.partitions?.length ?? 0), 0), settingsCount: settings.length,
    capturedSections: SECTIONS.filter((section) => availability[section].status === "captured"), unavailableSections: SECTIONS.filter((section) => availability[section].status === "unavailable"), discardedFields, warnings,
  };
  return { context, preview };
}

export function parseDatabaseContext(source: string): DatabaseContext { return inspectDatabaseContext(source).context; }

const captured = { status: "captured" as const };
export const databaseContextExample = JSON.stringify({
  version: 2,
  provenance: { collectedAt: new Date().toISOString(), postgresVersion: "16.4", collector: "manual", collectorVersion: "2", redacted: true },
  availability: { relationStats: captured, columnStats: captured, indexStats: captured, extendedStats: captured, partitions: { status: "unavailable", reason: "No partitioned relations selected." }, settings: captured },
  settings: [{ name: "default_statistics_target", value: "100" }, { name: "random_page_cost", value: "4" }],
  relations: [{ schema: "public", name: "orders", kind: "table", rowEstimate: 1250000, sizeBytes: 268435456, totalSizeBytes: 335544320, liveTuples: 1248000, deadTuples: 12000, modificationsSinceAnalyze: 8000, columns: [{ name: "customer_id", type: "bigint", nullFraction: 0, nDistinct: 85000, correlation: 0.12, statisticsTarget: 100 }], indexes: [{ name: "orders_pkey", columns: ["id"], accessMethod: "btree", unique: true, primary: true, valid: true, ready: true }], extendedStatistics: [], partitions: [] }],
}, null, 2);

export function findContextRelation(context: DatabaseContext | null, relationName: string) {
  if (!context || relationName === "—") return null;
  const parts = relationName.replaceAll('"', "").split(".");
  const name = parts.at(-1)?.toLowerCase();
  const schema = parts.length > 1 ? parts.at(-2)?.toLowerCase() : null;
  return context.relations.find((relation) => relation.name.toLowerCase() === name && (!schema || relation.schema.toLowerCase() === schema)) ?? null;
}
