import type { StepResult } from "./run";

export interface RunReport {
  runId: string;
  caseId: string;
  caseName: string;
  env: string;
  status: "passed" | "failed";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failureSummary?: string;
  steps: StepResult[];
}

export type ArtifactKind = "logs" | "screenshots" | "reports" | "traces";

export interface ArtifactSummary {
  kind: ArtifactKind;
  path: string;
  count: number;
  sizeBytes: number;
}

export interface RunHistoryItem {
  runId: string;
  caseId: string;
  caseName: string;
  env: string;
  status: "running" | "passed" | "failed";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  reportLinks: {
    html: string;
    json: string;
    logs: string;
  };
}

export interface ClearArtifactsResult {
  cleared: ArtifactSummary[];
  remaining: ArtifactSummary[];
}

export interface DeleteRunHistoryResult {
  deleted: boolean;
  runId: string;
  files: string[];
}
