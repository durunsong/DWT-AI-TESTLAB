import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AiReportService } from "./ai-report.service";

test("writes and reads AI analysis report records", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-ai-report-"));
  const service = new AiReportService(rootDir);

  await service.saveAnalysis({
    runId: "run_a",
    caseId: "case_a",
    caseName: "用例 A",
    env: "local",
    stepId: "click_save",
    stepName: "点击保存",
    source: "auto_failure",
    status: "completed",
    content: "## 结论\n接口返回业务失败。",
    screenshot: "/screenshots/run_a/click_save-failed.png",
    generatedAt: "2026-05-23T08:00:00.000Z"
  });

  const report = await service.readReport("run_a");

  assert.equal(report.runId, "run_a");
  assert.equal(report.caseId, "case_a");
  assert.equal(report.analyses.length, 1);
  assert.equal(report.analyses[0]?.stepId, "click_save");
  assert.equal(report.analyses[0]?.content, "## 结论\n接口返回业务失败。");
  assert.equal(report.analyses[0]?.reportFile, "/ai-reports/run_a/click_save.auto_failure.analysis.md");
  await assert.doesNotReject(() => fs.stat(path.join(rootDir, "ai-reports", "run_a", "click_save.auto_failure.analysis.md")));
});

test("replaces an existing AI analysis for the same step and source", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-ai-report-upsert-"));
  const service = new AiReportService(rootDir);

  await service.saveAnalysis({
    runId: "run_a",
    caseId: "case_a",
    env: "local",
    stepId: "step_a",
    source: "manual_screenshot",
    status: "completed",
    content: "first",
    generatedAt: "2026-05-23T08:00:00.000Z"
  });
  await service.saveAnalysis({
    runId: "run_a",
    caseId: "case_a",
    env: "local",
    stepId: "step_a",
    source: "manual_screenshot",
    status: "completed",
    content: "second",
    generatedAt: "2026-05-23T08:01:00.000Z"
  });

  const report = await service.readReport("run_a");

  assert.equal(report.analyses.length, 1);
  assert.equal(report.analyses[0]?.content, "second");
  assert.equal(report.analyses[0]?.generatedAt, "2026-05-23T08:01:00.000Z");
});
