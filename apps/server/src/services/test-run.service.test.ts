import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunReport } from "@ai-e2e/shared";
import { TestRunService } from "./test-run.service";

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
