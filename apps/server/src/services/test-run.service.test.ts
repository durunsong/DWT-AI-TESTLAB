import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunReport } from "@ai-e2e/shared";
import { TestRunService } from "./test-run.service";

test("resolves latest to the newest in-memory run", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-latest-running-"));
  const runner = {
    async run() {
      return new Promise<RunReport>(() => undefined);
    }
  };
  const service = new TestRunService(runner as never, rootDir);
  const first = await service.start({ caseId: "first_case", env: "local" });
  const second = await service.start({ caseId: "second_case", env: "local" });

  assert.equal(service.get("latest").runId, second.runId);
  assert.equal(service.get("latest").caseId, "second_case");
  assert.notEqual(service.get("latest").runId, first.runId);
});

test("subscribes latest to the newest in-memory run events", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-latest-events-"));
  let capturedRun: { onEvent?: (event: { runId: string; type: "step_updated"; at: string; step: RunReport["steps"][number] }) => void } | undefined;
  const runner = {
    async run(input: typeof capturedRun) {
      capturedRun = input;
      return new Promise<RunReport>(() => undefined);
    }
  };
  const service = new TestRunService(runner as never, rootDir);
  const summary = await service.start({ caseId: "event_case", env: "local" });
  const received: string[] = [];
  const unsubscribe = service.subscribe("latest", (event) => {
    if (event.step) {
      received.push(`${event.runId}:${event.step.stepId}`);
    }
  });

  capturedRun?.onEvent?.({
    runId: summary.runId,
    type: "step_updated",
    at: new Date().toISOString(),
    step: {
      stepId: "open_page",
      name: "打开页面",
      type: "web_open",
      status: "running"
    }
  });
  unsubscribe();

  assert.deepEqual(received, [`${summary.runId}:open_page`]);
});

test("emits automatic failure analysis after the AI response completes", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    AI_BASE_URL: process.env.AI_BASE_URL,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL
  };
  process.env.AI_BASE_URL = "https://ai.example.test/v1";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
  globalThis.fetch = (async () => Response.json({
    choices: [{ message: { content: "完整失败分析" } }]
  })) as typeof fetch;

  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-auto-ai-stream-"));
  await fs.mkdir(path.join(rootDir, "cases", "scenario"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "cases", "scenario", "demo_case.yaml"), "case_id: demo_case\nlocations:\n  file: cases/location/demo.yaml\n", "utf8");
  const logPath = path.join(rootDir, "logs", "run.log");
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.writeFile(logPath, "failure log", "utf8");
  const reportPath = path.join(rootDir, "reports", "run.json");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const report: RunReport = {
    runId: "0001_demo",
    caseId: "demo_case",
    caseName: "Demo Case",
    env: "local",
    status: "failed",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    total: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
    steps: [{
      stepId: "click_submit",
      name: "点击提交",
      type: "web_click",
      status: "failed",
      error: "提交失败"
    }],
    artifacts: {
      log: logPath,
      jsonReport: reportPath
    }
  };
  const runner = {
    async run() {
      await new Promise((resolve) => setImmediate(resolve));
      return report;
    }
  };
  const service = new TestRunService(runner as never, rootDir);
  const summary = await service.start({ caseId: "demo_case", env: "local" });
  const updates: string[] = [];
  const finished = new Promise<void>((resolve) => {
    service.subscribe(summary.runId, (event) => {
      if (event.type === "step_updated") {
        updates.push(event.step?.aiAnalysis?.content ?? "");
      }
      if (event.type === "run_finished") {
        resolve();
      }
    });
  });

  try {
    await finished;
    assert.deepEqual(updates, ["", "完整失败分析"]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.AI_BASE_URL = originalEnv.AI_BASE_URL;
    process.env.AI_API_KEY = originalEnv.AI_API_KEY;
    process.env.AI_MODEL = originalEnv.AI_MODEL;
  }
});

test("runs batch sequentially and keeps going after a failed case", async () => {
  const originalAiFailureAnalysis = process.env.AI_FAILURE_ANALYSIS;
  process.env.AI_FAILURE_ANALYSIS = "false";
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-batch-run-"));
  const calls: string[] = [];
  const runner = {
    async listCases() {
      return [
        { case_id: "first_case", case_name: "First Case", case_type: "smoke" },
        { case_id: "second_case", case_name: "Second Case", case_type: "regression" },
        { case_id: "third_case", case_name: "Third Case", case_type: "smoke" }
      ];
    },
    async run(input: { runId: string; caseId: string; env: string }) {
      calls.push(input.caseId);
      await new Promise((resolve) => setImmediate(resolve));
      const failed = input.caseId === "second_case";
      return {
        runId: input.runId,
        caseId: input.caseId,
        caseName: `${input.caseId} name`,
        env: input.env,
        status: failed ? "failed" : "passed",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        total: 1,
        passed: failed ? 0 : 1,
        failed: failed ? 1 : 0,
        skipped: 0,
        steps: [{
          stepId: "step_1",
          name: "Step 1",
          type: "web_open",
          status: failed ? "failed" : "passed",
          error: failed ? "failed on purpose" : undefined
        }],
        artifacts: {}
      } satisfies RunReport;
    }
  };
  const service = new TestRunService(runner as never, rootDir);

  const started = await service.startBatch({ caseIds: ["first_case", "second_case", "third_case"], env: "local" });
  await waitFor(() => service.getBatch(started.batchId).status !== "running");
  const batch = service.getBatch(started.batchId);

  assert.deepEqual(calls, ["first_case", "second_case", "third_case"]);
  assert.equal(batch.total, 3);
  assert.equal(batch.passed, 2);
  assert.equal(batch.failed, 1);
  assert.equal(batch.pending, 0);
  assert.equal(batch.running, 0);
  assert.equal(batch.status, "failed");
  assert.equal(batch.items[1]?.status, "failed");
  assert.equal(batch.items[1]?.caseType, "regression");
  assert.ok(batch.items.every((item) => item.runId && item.reportLinks?.json));

  process.env.AI_FAILURE_ANALYSIS = originalAiFailureAnalysis;
});

async function waitFor(assertion: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (!assertion()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("等待条件超时");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
