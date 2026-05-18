import type { SessionName } from "../constants/session";
import type { StepType } from "../constants/step-types";

export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export interface ScenarioStep {
  step_id: string;
  name: string;
  type: StepType;
  session?: SessionName;
  target?: string;
  url?: string;
  value?: string;
  expected?: string;
  variable?: string;
  timeout_ms?: number;
  continue_on_failure?: boolean;
  username?: string;
  password?: string;
  file?: string;
}

export interface StepResult {
  stepId: string;
  name: string;
  type: StepType;
  session?: SessionName;
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
}
