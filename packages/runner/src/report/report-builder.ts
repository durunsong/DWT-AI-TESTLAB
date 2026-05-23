import type { RunReport, StepResult } from "@ai-e2e/shared";
import type { ArtifactPaths } from "../utils/artifact";
import { HtmlReportBuilder } from "./html-report-builder";
import { JsonReportBuilder } from "./json-report-builder";
import { buildDeveloperHandoffSummary } from "./developer-summary";

export class ReportBuilder {
  private readonly json = new JsonReportBuilder();
  private readonly html = new HtmlReportBuilder();

  async build(input: {
    runId: string;
    caseId: string;
    caseName: string;
    env: string;
    status: "running" | "passed" | "failed";
    startedAt: string;
    endedAt?: string;
    steps: StepResult[];
    artifacts: ArtifactPaths;
  }): Promise<RunReport> {
    const durationMs = input.endedAt ? new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime() : undefined;
    const failedStep = input.steps.find((step) => step.status === "failed");
    const report: RunReport = {
      runId: input.runId,
      caseId: input.caseId,
      caseName: input.caseName,
      env: input.env,
      status: input.status,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMs,
      total: input.steps.length,
      passed: input.steps.filter((step) => step.status === "passed").length,
      failed: input.steps.filter((step) => step.status === "failed").length,
      skipped: input.steps.filter((step) => step.status === "skipped").length,
      steps: input.steps,
      artifacts: {
        jsonReport: input.artifacts.jsonReport,
        htmlReport: input.artifacts.htmlReport,
        log: input.artifacts.logFile,
        screenshotsDir: input.artifacts.screenshotsDir,
        tracesDir: input.artifacts.tracesDir
      },
      failureSummary: failedStep?.error,
      developerSummary: buildDeveloperHandoffSummary({
        runId: input.runId,
        caseId: input.caseId,
        env: input.env,
        failedStep,
        artifacts: input.artifacts
      })
    };

    await this.json.write(input.artifacts.jsonReport, report);
    await this.html.write(input.artifacts.htmlReport, report);
    return report;
  }
}
