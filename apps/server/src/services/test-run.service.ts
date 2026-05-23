import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { buildFailureAnalysisMessages, OpenAiCompatibleClient } from "@ai-e2e/ai-generator";
import { resolveArtifactBaseDir, ScenarioOrchestrator, type PlatformArtifactKind, type PlatformConfig } from "@ai-e2e/runner";
import { maskSensitive, type CreateTestRunRequest, type RunReport, type StepResult, type TestRunEvent, type TestRunSummary } from "@ai-e2e/shared";
import { imageMimeType } from "./ai-screenshot";
import type { AiReportService } from "./ai-report.service";
import type { EnvConfigService } from "./env-config.service";
import { normalizeTestEnv } from "./env-config.service";
import { createNextRunId } from "./run-id";

export class TestRunService {
  private readonly runs = new Map<string, TestRunSummary>();
  private readonly events = new EventEmitter();

  constructor(
    private readonly runner: ScenarioOrchestrator,
    private readonly rootDir: string,
    private readonly envConfigService?: EnvConfigService,
    private readonly platformConfig?: PlatformConfig,
    private readonly aiReportService?: AiReportService
  ) {
    this.events.setMaxListeners(100);
  }

  async start(request: CreateTestRunRequest): Promise<TestRunSummary> {
    const env = normalizeTestEnv(request.env);
    await this.envConfigService?.applyToProcess(env);
    const runId = await createNextRunId(this.rootDir, request.caseId, this.platformConfig);
    const startedAt = new Date().toISOString();
    const summary: TestRunSummary = {
      runId,
      caseId: request.caseId,
      env,
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
      env,
      onEvent: (event) => {
        if (event.type !== "run_finished") {
          this.applyEvent(summary, event);
        }
      }
    }).then((report) => {
      this.applyReport(summary, report);
      return this.analyzeFailure(summary, report);
    }).then(() => {
      this.emit({
        runId,
        type: "run_finished",
        status: summary.status,
        at: summary.endedAt ?? new Date().toISOString(),
        message: summary.steps.find((step) => step.status === "failed")?.error
      });
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
    if (event.step?.status === "failed" && process.env.AI_FAILURE_ANALYSIS !== "false" && !event.step.aiAnalysis) {
      event.step.aiAnalysis = { status: "pending" };
    }
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
    const aiAnalysisByStepId = new Map(summary.steps.map((step) => [step.stepId, step.aiAnalysis]));
    summary.caseName = report.caseName;
    summary.status = report.status;
    summary.total = report.total;
    summary.passed = report.passed;
    summary.failed = report.failed;
    summary.skipped = report.skipped;
    summary.endedAt = report.endedAt;
    summary.durationMs = report.durationMs;
    summary.steps = report.steps.map((step) => ({
      ...step,
      aiAnalysis: step.aiAnalysis ?? aiAnalysisByStepId.get(step.stepId)
    }));
    summary.reportLinks = this.links(report.runId);
  }

  private async analyzeFailure(summary: TestRunSummary, report: RunReport): Promise<void> {
    if (report.status !== "failed" || process.env.AI_FAILURE_ANALYSIS === "false") {
      return;
    }
    const failedStep = summary.steps.find((step) => step.status === "failed");
    if (!failedStep) {
      return;
    }

    failedStep.aiAnalysis = { status: "pending" };
    this.emit({ runId: summary.runId, type: "step_updated", status: "failed", step: failedStep, at: new Date().toISOString(), message: "AI 正在分析失败原因" });

    try {
      const content = await this.buildFailureAnalysis(summary, report, failedStep);
      failedStep.aiAnalysis = {
        status: "completed",
        content,
        generatedAt: new Date().toISOString()
      };
      await this.aiReportService?.saveAnalysis({
        runId: summary.runId,
        caseId: summary.caseId,
        caseName: summary.caseName,
        env: summary.env,
        stepId: failedStep.stepId,
        stepName: failedStep.name,
        source: "auto_failure",
        status: "completed",
        content,
        screenshot: failedStep.screenshot,
        generatedAt: failedStep.aiAnalysis.generatedAt
      });
    } catch (error) {
      const generatedAt = new Date().toISOString();
      failedStep.aiAnalysis = {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        generatedAt
      };
      await this.aiReportService?.saveAnalysis({
        runId: summary.runId,
        caseId: summary.caseId,
        caseName: summary.caseName,
        env: summary.env,
        stepId: failedStep.stepId,
        stepName: failedStep.name,
        source: "auto_failure",
        status: "failed",
        error: failedStep.aiAnalysis.error,
        screenshot: failedStep.screenshot,
        generatedAt
      }).catch(() => undefined);
    }

    report.steps = summary.steps;
    await this.writeJsonReport(report).catch(() => undefined);
    this.emit({ runId: summary.runId, type: "step_updated", status: "failed", step: failedStep, at: new Date().toISOString(), message: "AI 失败分析完成" });
  }

  private async buildFailureAnalysis(
    summary: TestRunSummary,
    report: RunReport,
    failedStep: StepResult
  ): Promise<string> {
    const [logsTail, scenarioYaml, locationYaml, imageDataUrl] = await Promise.all([
      readTail(report.artifacts.log),
      this.readScenarioYaml(summary.caseId),
      this.readLocationYaml(summary.caseId),
      readImageDataUrl(failedStep.screenshot)
    ]);
    const client = new OpenAiCompatibleClient({ temperature: 0.1 });
    const messages = buildFailureAnalysisMessages({
      imageDataUrl,
      runId: summary.runId,
      caseId: summary.caseId,
      env: summary.env,
      failedStep: maskSensitive(failedStep),
      logsTail,
      scenarioYaml,
      locationYaml
    });
    return client.chat(messages);
  }

  private async readScenarioYaml(caseId: string): Promise<string | undefined> {
    const scenarioDir = path.resolve(this.rootDir, "cases", "scenario");
    const files = await fs.readdir(scenarioDir).catch(() => []);
    for (const file of files.filter((item) => item.endsWith(".yaml") || item.endsWith(".yml"))) {
      const filePath = path.resolve(scenarioDir, file);
      const content = await fs.readFile(filePath, "utf8").catch(() => "");
      if (content.includes(`case_id: ${caseId}`) || content.includes(`case_id: "${caseId}"`) || content.includes(`case_id: '${caseId}'`)) {
        return content;
      }
    }
    return undefined;
  }

  private async readLocationYaml(caseId: string): Promise<string | undefined> {
    const scenarioYaml = await this.readScenarioYaml(caseId);
    const match = scenarioYaml?.match(/^\s*file:\s*['"]?([^'"\r\n]+)['"]?/m);
    if (!match?.[1]) {
      return undefined;
    }
    return fs.readFile(path.resolve(this.rootDir, match[1]), "utf8").catch(() => undefined);
  }

  private async writeJsonReport(report: RunReport): Promise<void> {
    if (!report.artifacts.jsonReport) {
      return;
    }
    await fs.writeFile(report.artifacts.jsonReport, `${JSON.stringify(maskSensitive(report), null, 2)}\n`, "utf8");
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

  artifactPath(kind: PlatformArtifactKind, ...segments: string[]): string {
    const baseDir = this.platformConfig ? resolveArtifactBaseDir(this.rootDir, this.platformConfig, kind) : path.resolve(this.rootDir, kind);
    return path.resolve(baseDir, ...segments);
  }
}

async function readTail(filePath: string | undefined, maxChars = 24_000): Promise<string | undefined> {
  if (!filePath) {
    return undefined;
  }
  const content = await fs.readFile(filePath, "utf8").catch(() => undefined);
  if (!content) {
    return undefined;
  }
  return content.length > maxChars ? content.slice(-maxChars) : content;
}

async function readImageDataUrl(filePath: string | undefined): Promise<string | undefined> {
  if (!filePath) {
    return undefined;
  }
  const image = await fs.readFile(filePath).catch(() => undefined);
  if (!image) {
    return undefined;
  }
  return `data:${imageMimeType(filePath)};base64,${image.toString("base64")}`;
}
