import crypto from "node:crypto";
import { resolveRecordValues, type RunReport, type ScenarioStep, type StepResult, type TestRunEvent } from "@ai-e2e/shared";
import { ContextManager } from "../context/context-manager";
import { LocationLoader } from "../loader/location-loader";
import { ScenarioLoader } from "../loader/scenario-loader";
import { ReportBuilder } from "../report/report-builder";
import { SessionManager } from "../session/session-manager";
import { createArtifactPaths } from "../utils/artifact";
import { EnvGuard } from "../utils/env-guard";
import { RunLogger } from "../utils/logger";
import { VisualExecutor } from "../executors/visual-executor";
import { DbExecutor } from "../executors/db-executor";
import { DbStepExecutor } from "../executors/db-step-executor";
import { WebExecutor } from "../executors/web-executor";

export type RunnerEventHandler = (event: TestRunEvent) => void | Promise<void>;

export interface ScenarioRunInput {
  caseId: string;
  env: string;
  runId?: string;
  onEvent?: RunnerEventHandler;
}

export class ScenarioOrchestrator {
  private readonly scenarioLoader: ScenarioLoader;
  private readonly locationLoader: LocationLoader;
  private readonly contextManager = new ContextManager();
  private readonly reportBuilder = new ReportBuilder();

  constructor(private readonly rootDir: string) {
    this.scenarioLoader = new ScenarioLoader(rootDir);
    this.locationLoader = new LocationLoader(rootDir);
  }

  async listCases() {
    return this.scenarioLoader.list();
  }

  async run(input: ScenarioRunInput): Promise<RunReport> {
    EnvGuard.assertRunnable(input.env);
    const scenario = await this.scenarioLoader.loadByCaseId(input.caseId);
    const runId = input.runId ?? `run_${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const artifacts = await createArtifactPaths(this.rootDir, runId);
    const logger = new RunLogger(artifacts.logFile);
    const context = this.contextManager.create(runId, input.env, scenario);
    EnvGuard.assertRunnable(input.env, { ...scenario, sessions: Object.values(context.state.sessions) });

    const locations = await this.locationLoader.load(scenario.locations.file);
    const steps = scenario.steps.map((step) => this.createPendingResult(step));
    const sessionManager = new SessionManager({
      headless: process.env.HEADLESS === "true",
      slowMo: Number(process.env.SLOW_MO ?? 100),
      tracesDir: artifacts.tracesDir
    });
    const visual = new VisualExecutor(process.env.VISUAL_MODE === "true" || process.env.HEADLESS !== "true");
    const dbExecutor = new DbStepExecutor({
      context,
      db: new DbExecutor({ env: input.env, enabled: process.env.DB_ENABLED === "true" })
    });
    const webExecutor = new WebExecutor({
      rootDir: this.rootDir,
      locations,
      context,
      logger,
      visual,
      screenshotDir: artifacts.screenshotsDir,
      defaults: scenario.defaults,
      getPage: (session) => sessionManager.getPage(session),
      newPage: (session) => sessionManager.newPage(session)
    });

    await this.emit(input.onEvent, { runId, type: "run_started", status: "running", at: startedAt, message: scenario.case_name });
    await logger.info("测试运行开始", { runId, caseId: scenario.case_id, env: input.env });

    let failed = false;
    try {
      await sessionManager.initialize(Object.values(context.state.sessions));

      for (let index = 0; index < scenario.steps.length; index += 1) {
        const originalStep = scenario.steps[index];
        const stepResult = steps[index];
        if (!originalStep || !stepResult) continue;

        if (failed) {
          stepResult.status = "skipped";
          await this.emit(input.onEvent, { runId, type: "step_updated", status: "skipped", step: stepResult, at: new Date().toISOString() });
          continue;
        }

        stepResult.status = "running";
        stepResult.startedAt = new Date().toISOString();
        await this.emit(input.onEvent, { runId, type: "step_updated", status: "running", step: stepResult, at: stepResult.startedAt });

        let step = originalStep;
        try {
          step = resolveRecordValues(originalStep, context.state, originalStep) as ScenarioStep;
          const partial = this.isDbStep(step)
            ? await dbExecutor.execute(step)
            : await this.executeWebStep(sessionManager, webExecutor, step);
          Object.assign(stepResult, partial);
          stepResult.status = "passed";
          stepResult.endedAt = new Date().toISOString();
          stepResult.durationMs = new Date(stepResult.endedAt).getTime() - new Date(stepResult.startedAt).getTime();
          await logger.info(`步骤执行成功：${step.step_id}`, { durationMs: stepResult.durationMs });
          await this.emit(input.onEvent, { runId, type: "step_updated", status: "passed", step: stepResult, at: stepResult.endedAt });
        } catch (error) {
          const page = step.session && !this.isDbStep(step) ? await sessionManager.getPage(step.session).catch(() => undefined) : undefined;
          const apiDiagnostic = readApiDiagnostic(error);
          if (page) {
            const failurePartial = await webExecutor.captureFailure(page, step.step_id);
            Object.assign(stepResult, {
              ...failurePartial,
              data: mergeStepData(failurePartial.data, apiDiagnostic ? { api: apiDiagnostic } : undefined)
            });
            await visual.updateStep(page, step, "failed");
          } else if (apiDiagnostic) {
            stepResult.data = mergeStepData(stepResult.data, { api: apiDiagnostic });
          }
          stepResult.status = "failed";
          stepResult.endedAt = new Date().toISOString();
          stepResult.durationMs = new Date(stepResult.endedAt).getTime() - new Date(stepResult.startedAt).getTime();
          stepResult.error = error instanceof Error ? error.message : String(error);
          await logger.error(`步骤执行失败：${step.step_id}`, { error: stepResult.error, data: stepResult.data });
          await this.emit(input.onEvent, { runId, type: "step_updated", status: "failed", step: stepResult, at: stepResult.endedAt });
          failed = !step.continue_on_failure;
        }
      }
    } catch (error) {
      const firstPending = steps.find((step) => step.status === "pending" || step.status === "running");
      if (firstPending) {
        firstPending.status = "failed";
        firstPending.error = error instanceof Error ? error.message : String(error);
        firstPending.endedAt = new Date().toISOString();
      }
      await logger.error("测试运行异常中断", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      for (const session of Object.keys(context.state.sessions)) {
        await sessionManager.saveTrace(session as never, runId).catch(() => undefined);
      }
      await sessionManager.closeAll();
    }

    const endedAt = new Date().toISOString();
    const status = steps.some((step) => step.status === "failed") ? "failed" : "passed";
    const report = await this.reportBuilder.build({
      runId,
      caseId: scenario.case_id,
      caseName: scenario.case_name,
      env: input.env,
      status,
      startedAt,
      endedAt,
      steps,
      artifacts
    });
    await logger.info("测试运行结束", { runId, status });
    await this.emit(input.onEvent, { runId, type: "run_finished", status, at: endedAt, message: report.failureSummary });
    return report;
  }

  private createPendingResult(step: ScenarioStep): StepResult {
    return {
      stepId: step.step_id,
      name: step.name,
      type: step.type,
      session: step.session,
      status: "pending"
    };
  }

  private async executeWebStep(sessionManager: SessionManager, webExecutor: WebExecutor, step: ScenarioStep): Promise<Partial<StepResult>> {
    if (!step.session) {
      throw new Error(`${step.type} 必须指定 session`);
    }
    const page = await sessionManager.getPage(step.session);
    return webExecutor.execute(page, step);
  }

  private isDbStep(step: ScenarioStep): boolean {
    return step.type === "db_query" || step.type === "db_assert" || step.type === "db_clean";
  }

  private async emit(handler: RunnerEventHandler | undefined, event: TestRunEvent): Promise<void> {
    await handler?.(event);
  }
}

function readApiDiagnostic(error: unknown): unknown | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  return (error as { apiDiagnostic?: unknown }).apiDiagnostic;
}

function mergeStepData(left: unknown, right: Record<string, unknown> | undefined): unknown {
  if (!right) {
    return left;
  }
  if (!left || typeof left !== "object" || Array.isArray(left)) {
    return right;
  }
  return { ...(left as Record<string, unknown>), ...right };
}
