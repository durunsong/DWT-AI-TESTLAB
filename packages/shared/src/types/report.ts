import type { StepResult } from "./step";

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
  status: "running" | "passed" | "failed";
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  steps: StepResult[];
  artifacts: {
    jsonReport?: string;
    htmlReport?: string;
    log?: string;
    screenshotsDir?: string;
    tracesDir?: string;
  };
  failureSummary?: string;
  developerSummary?: DeveloperHandoffSummary;
}
