import type { StepResult, StepStatus } from "./step";

export type RunStatus = "queued" | "running" | "passed" | "failed";

export interface TestRunSummary {
  runId: string;
  caseId: string;
  caseName?: string;
  env: string;
  status: RunStatus;
  currentStep?: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  steps: StepResult[];
  reportLinks: {
    json?: string;
    html?: string;
    logs?: string;
    screenshots?: string;
    traces?: string;
  };
}

export interface CreateTestRunRequest {
  caseId: string;
  env: string;
}

export interface CreateTestRunResponse {
  runId: string;
  status: RunStatus;
}

export interface TestRunEvent {
  runId: string;
  type: "run_started" | "step_updated" | "run_finished" | "log";
  status?: RunStatus | StepStatus;
  message?: string;
  step?: StepResult;
  at: string;
}
