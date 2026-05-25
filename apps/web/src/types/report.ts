import type { StepResult } from "./run";

export type DeveloperOwnerHint = "frontend" | "backend" | "test" | "environment" | "unknown";
export type DeveloperFailureCategory =
  | "api_business_failure"
  | "locator_or_ui_change"
  | "assertion_failure"
  | "environment_or_data"
  | "automation_runtime"
  | "unknown";

export interface DeveloperHandoffSummary {
  title: string;
  severity: "blocker" | "major" | "minor";
  ownerHint: DeveloperOwnerHint;
  category: DeveloperFailureCategory;
  failedStepId: string;
  failedStepName: string;
  failedStepType: string;
  evidence: string[];
  reproduce: string[];
  suggestedAction: string;
  relatedArtifacts: {
    screenshot?: string;
    trace?: string;
    log?: string;
    jsonReport?: string;
    htmlReport?: string;
  };
}

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
  developerSummary?: DeveloperHandoffSummary;
  steps: StepResult[];
}

export type ArtifactKind = "logs" | "screenshots" | "reports" | "traces" | "videos" | "ai-reports";

export interface AiAnalysisRecord {
  stepId: string;
  stepName?: string;
  source: "auto_failure" | "manual_screenshot";
  status: "completed" | "failed";
  content?: string;
  error?: string;
  generatedAt: string;
  screenshot?: string;
  reportFile?: string;
}

export interface AiRunReport {
  runId: string;
  caseId?: string;
  caseName?: string;
  env?: string;
  updatedAt: string;
  analyses: AiAnalysisRecord[];
}

export interface ArtifactSummary {
  kind: ArtifactKind;
  path: string;
  count: number;
  sizeBytes: number;
}

export interface ArtifactFile {
  name: string;
  path: string;
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
  developerSummary?: DeveloperHandoffSummary;
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
