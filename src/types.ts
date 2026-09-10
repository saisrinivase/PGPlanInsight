export type Severity = "critical" | "warning" | "info";

export type EvidenceClassification = "observed" | "derived" | "suspected" | "unknown" | "verified";
export type EvidenceClaimStatus = "available" | "not-established";

export interface EvidenceClaim {
  classification: EvidenceClassification;
  status: EvidenceClaimStatus;
  label: string;
  detail: string;
}

export interface PlanNode {
  "Node Type"?: string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  "Actual Loops"?: number;
  "Plan Rows"?: number;
  "Total Cost"?: number;
  "Rows Removed by Filter"?: number;
  "Rows Removed by Join Filter"?: number;
  "Heap Fetches"?: number;
  "Shared Read Blocks"?: number;
  "Shared Hit Blocks"?: number;
  "Temp Read Blocks"?: number;
  "Temp Written Blocks"?: number;
  "Temp I/O Read Time"?: number;
  "Temp I/O Write Time"?: number;
  "WAL Records"?: number;
  "WAL Bytes"?: number;
  "Peak Memory Usage"?: number;
  "Disk Usage"?: number;
  "Storage Type"?: string;
  "HashAgg Batches"?: number;
  "Hash Batches"?: number;
  Batches?: number;
  "Workers Planned"?: number;
  "Workers Launched"?: number;
  "Sort Method"?: string;
  "Filter"?: string;
  "Index Cond"?: string;
  "Recheck Cond"?: string;
  "Hash Cond"?: string;
  "Merge Cond"?: string;
  "Join Filter"?: string;
  Output?: string | string[];
  "Sort Key"?: string | string[];
  "Group Key"?: string | string[];
  Plans?: PlanNode[];
  [key: string]: unknown;
}

export interface PlanEnvelope {
  Plan: PlanNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
  Settings?: Record<string, unknown> | Array<Record<string, unknown>>;
  "Serialization Time"?: number;
  __format?: "JSON" | "TEXT";
  __postgresMajor?: number | null;
  [key: string]: unknown;
}

export interface Finding {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  evidence: string;
  nextAction: string;
}

export interface NodeMetric {
  rank: number;
  nodeType: string;
  relation: string;
  totalTime: number;
  rows: number;
  plannedRows: number;
  loops: number;
  estimateRatio: number | null;
  tempBlocks: number;
  sharedReads: number;
}

export interface PlanVisualNode extends NodeMetric {
  depth: number;
  path: string;
  selfTime: number;
  timeShare: number;
  flags: string[];
  workersPlanned: number;
  workersLaunched: number;
  predicate: string;
  actualTimingCaptured?: boolean;
  heapFetches?: number | null;
  rowsRemovedByFilter?: number;
  sharedHits?: number;
  tempReadBlocks: number;
  tempWrittenBlocks: number;
  tempReadTime: number;
  tempWriteTime: number;
  spillRole: "direct" | "inherited" | null;
  spillMethod: string;
  expressions?: Array<{ source: string; text: string }>;
}

export interface Analysis {
  format: "JSON" | "TEXT";
  postgresMajor: number | null;
  adapter: string;
  score: number;
  evidenceLevel: "Strong" | "Usable" | "Weak";
  executionTime: number | null;
  planningTime: number | null;
  nodeCount: number;
  primarySignal: string;
  headline: string;
  checks: Array<{ label: string; present: boolean; value: string }>;
  findings: Finding[];
  hotspots: NodeMetric[];
  planMap: PlanVisualNode[];
  settings: Array<{ name: string; value: string }>;
  metrics: {
    rootSharedHits: number;
    rootSharedReads: number;
    rootTempBlocks: number;
    rootWalRecords: number;
    rootWalBytes: number;
    maxRowsRemoved: number;
    maxLoops: number;
    maxHashBatches: number;
    workersPlanned: number;
    workersLaunched: number;
  };
}
