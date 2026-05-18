import type { ScenarioCase, ScenarioSession } from "./case";

export interface RuntimeContextState {
  runId: string;
  env: string;
  scenario: ScenarioCase;
  timestamp: string;
  variables: Record<string, string>;
  sessions: Record<string, ScenarioSession>;
}
