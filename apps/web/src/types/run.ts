export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";
export type RunStatus = "queued" | "running" | "passed" | "failed";

export interface StepResult {
  stepId: string;
  name: string;
  type: string;
  session?: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  message?: string;
  error?: string;
  screenshot?: string;
  trace?: string;
  data?: unknown;
}

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

export interface CreateTestRunParams {
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
