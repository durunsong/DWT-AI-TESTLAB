import type { StepResult } from "./step";

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
}
