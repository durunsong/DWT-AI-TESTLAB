import type { SessionName } from "../constants/session";
import type { StepType } from "../constants/step-types";

export type StepStatus = "pending" | "running" | "passed" | "failed" | "skipped";
export type DbParam = string | number | boolean | null;
export type DbExpected = Record<string, string | number | boolean | null>;

export interface ScenarioStep {
  step_id: string;
  name: string;
  type: StepType;
  session?: SessionName;
  target?: string;
  url?: string;
  value?: string;
  expected?: string | DbExpected;
  variable?: string;
  save_as?: string;
  sql?: string;
  params?: DbParam[];
  row_index?: number;
  timeout_ms?: number;
  wait_for_network?: boolean;
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
  data?: unknown;
}
