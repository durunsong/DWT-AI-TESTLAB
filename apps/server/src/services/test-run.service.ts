import { EventEmitter } from "node:events";
import path from "node:path";
import { ScenarioOrchestrator } from "@ai-e2e/runner";
import type { CreateTestRunRequest, RunReport, TestRunEvent, TestRunSummary } from "@ai-e2e/shared";
import { createNextRunId } from "./run-id";

export class TestRunService {
  private readonly runs = new Map<string, TestRunSummary>();
  private readonly events = new EventEmitter();

  constructor(
    private readonly runner: ScenarioOrchestrator,
    private readonly rootDir: string
  ) {
    this.events.setMaxListeners(100);
  }

  async start(request: CreateTestRunRequest): Promise<TestRunSummary> {
    const runId = await createNextRunId(this.rootDir, request.caseId);
    const startedAt = new Date().toISOString();
    const summary: TestRunSummary = {
      runId,
      caseId: request.caseId,
      env: request.env,
      status: "running",
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      startedAt,
      steps: [],
      reportLinks: this.links(runId)
    };
    this.runs.set(runId, summary);

    void this.runner.run({
      runId,
      caseId: request.caseId,
      env: request.env,
      onEvent: (event) => this.applyEvent(summary, event)
    }).then((report) => {
      this.applyReport(summary, report);
    }).catch((error) => {
      summary.status = "failed";
      summary.endedAt = new Date().toISOString();
      summary.durationMs = new Date(summary.endedAt).getTime() - new Date(summary.startedAt).getTime();
      summary.steps = [{
        stepId: "runner_error",
        name: "运行器异常",
        type: "web_open",
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      }];
      summary.total = 1;
      summary.failed = 1;
      this.emit({ runId, type: "run_finished", status: "failed", at: summary.endedAt, message: summary.steps[0]?.error });
    });

    return summary;
  }

  get(runId: string): TestRunSummary {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`未找到运行记录：${runId}`);
    }
    return run;
  }

  subscribe(runId: string, listener: (event: TestRunEvent) => void): () => void {
    const key = `run:${runId}`;
    this.events.on(key, listener);
    return () => this.events.off(key, listener);
  }

  private applyEvent(summary: TestRunSummary, event: TestRunEvent): void {
    if (event.step) {
      const index = summary.steps.findIndex((step) => step.stepId === event.step?.stepId);
      if (index >= 0) {
        summary.steps[index] = event.step;
      } else {
        summary.steps.push(event.step);
      }
      summary.currentStep = event.step.stepId;
      summary.total = summary.steps.length;
      summary.passed = summary.steps.filter((step) => step.status === "passed").length;
      summary.failed = summary.steps.filter((step) => step.status === "failed").length;
      summary.skipped = summary.steps.filter((step) => step.status === "skipped").length;
    }
    if (event.type === "run_finished") {
      summary.status = event.status === "failed" ? "failed" : "passed";
      summary.endedAt = event.at;
      summary.durationMs = new Date(summary.endedAt).getTime() - new Date(summary.startedAt).getTime();
    }
    this.emit(event);
  }

  private applyReport(summary: TestRunSummary, report: RunReport): void {
    summary.caseName = report.caseName;
    summary.status = report.status;
    summary.total = report.total;
    summary.passed = report.passed;
    summary.failed = report.failed;
    summary.skipped = report.skipped;
    summary.endedAt = report.endedAt;
    summary.durationMs = report.durationMs;
    summary.steps = report.steps;
    summary.reportLinks = this.links(report.runId);
  }

  private emit(event: TestRunEvent): void {
    this.events.emit(`run:${event.runId}`, event);
  }

  private links(runId: string): TestRunSummary["reportLinks"] {
    return {
      json: `/api/test-runs/${runId}/report`,
      html: `/reports/${runId}.html`,
      logs: `/api/test-runs/${runId}/logs`,
      screenshots: `/screenshots/${runId}`,
      traces: `/traces/${runId}`
    };
  }

  assetPath(...segments: string[]): string {
    return path.resolve(this.rootDir, ...segments);
  }
}
