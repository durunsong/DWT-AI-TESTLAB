import { ScenarioOrchestrator } from "@ai-e2e/runner";

export class CaseService {
  constructor(private readonly runner: ScenarioOrchestrator) {}

  async listCases() {
    const cases = await this.runner.listCases();
    return cases.map((item) => ({
      caseId: item.case_id,
      caseName: item.case_name,
      description: item.description,
      mode: item.mode,
      total: item.steps.length
    }));
  }
}
