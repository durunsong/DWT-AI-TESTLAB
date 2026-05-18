import type { RuntimeContextState, ScenarioCase, ScenarioSession } from "@ai-e2e/shared";

export class RuntimeContext {
  readonly state: RuntimeContextState;

  constructor(input: {
    runId: string;
    env: string;
    scenario: ScenarioCase;
    timestamp: string;
    variables: Record<string, string>;
    sessions: Record<string, ScenarioSession>;
  }) {
    this.state = input;
  }

  setVariable(key: string, value: string): void {
    this.state.variables[key] = value;
  }

  getVariable(key: string): string | undefined {
    return this.state.variables[key];
  }
}
