import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { HtmlReportBuilder } from "./html-report-builder";
import type { RunReport } from "@ai-e2e/shared";

test("renders developer handoff summary in html report", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-html-report-"));
  const reportPath = path.join(rootDir, "report.html");
  const report: RunReport = {
    runId: "run_a",
    caseId: "case_a",
    caseName: "用例 A",
    env: "local",
    status: "failed",
    startedAt: "2026-05-23T08:00:00.000Z",
    endedAt: "2026-05-23T08:01:00.000Z",
    total: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
    steps: [],
    artifacts: {},
    developerSummary: {
      title: "后端接口或业务返回异常：click_save",
      severity: "major",
      ownerHint: "backend",
      category: "api_business_failure",
      failedStepId: "click_save",
      failedStepName: "点击保存",
      failedStepType: "web_click",
      evidence: ["接口返回 code=1001"],
      reproduce: ["执行 case_a"],
      suggestedAction: "检查保存接口",
      relatedArtifacts: {}
    }
  };

  await new HtmlReportBuilder().write(reportPath, report);
  const html = await fs.readFile(reportPath, "utf8");

  assert.match(html, /开发处理摘要/);
  assert.match(html, /建议处理人/);
  assert.match(html, /后端接口或业务返回异常/);
});
