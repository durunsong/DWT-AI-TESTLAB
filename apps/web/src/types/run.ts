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
  url?: string;
  title?: string;
  data?: unknown;
  aiAnalysis?: {
    status: "pending" | "completed" | "failed";
    content?: string;
    error?: string;
    generatedAt?: string;
  };
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
    videos?: string;
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

export interface CreateBatchTestRunParams {
  caseIds: string[];
  env: string;
}

export interface CreateBatchTestRunResponse {
  batchId: string;
  status: "running";
  total: number;
  runIds?: string[];
}

export type BatchRunStatus = "pending" | "running" | "passed" | "failed";

export interface BatchRunItem {
  caseId: string;
  caseName: string;
  caseType: string;
  runId?: string;
  status: BatchRunStatus;
  startedAt?: string;
  endedAt?: string;
  reportLinks?: TestRunSummary["reportLinks"];
  error?: string;
}

export interface BatchTestRunSummary {
  batchId: string;
  env: string;
  status: Exclude<BatchRunStatus, "pending">;
  total: number;
  passed: number;
  failed: number;
  running: number;
  pending: number;
  startedAt: string;
  endedAt?: string;
  items: BatchRunItem[];
}

export interface TestRunEvent {
  runId: string;
  type: "run_started" | "step_updated" | "run_finished" | "log";
  status?: RunStatus | StepStatus;
  message?: string;
  step?: StepResult;
  at: string;
}
