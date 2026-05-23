import assert from "node:assert/strict";
import test from "node:test";
import { buildDeveloperHandoffSummary } from "./developer-summary";
import type { StepResult } from "@ai-e2e/shared";

test("builds backend handoff summary from API business failure", () => {
  const failedStep: StepResult = {
    stepId: "click_save",
    name: "点击保存",
    type: "web_click",
    status: "failed",
    error: "接口业务码不符合预期：code 期望 0000，实际 1001",
    screenshot: "screenshots/run_a/click_save-failed.png",
    trace: "traces/run_a/trace.zip",
    data: {
      waitForApi: {
        url: "/api/profile/save",
        method: "POST",
        status: 200,
        failed: true,
        failureReason: "code=1001",
        bodyJson: {
          code: "1001",
          msg: "file is null"
        }
      }
    }
  };

  const summary = buildDeveloperHandoffSummary({
    runId: "run_a",
    caseId: "case_a",
    env: "local",
    failedStep,
    artifacts: {
      jsonReport: "reports/run_a.json",
      htmlReport: "reports/run_a.html",
      logFile: "logs/run_a.log",
      screenshotsDir: "screenshots/run_a",
      tracesDir: "traces/run_a"
    }
  });

  assert.equal(summary?.ownerHint, "backend");
  assert.equal(summary?.category, "api_business_failure");
  assert.equal(summary?.failedStepId, "click_save");
  assert.match(summary?.title ?? "", /后端接口/);
  assert.ok(summary?.evidence.some((item) => item.includes("/api/profile/save")));
  assert.equal(summary?.relatedArtifacts.screenshot, failedStep.screenshot);
});

test("builds locator handoff summary from missing element failure", () => {
  const failedStep: StepResult = {
    stepId: "input_username",
    name: "输入用户名",
    type: "web_input",
    status: "failed",
    error: "未找到定位定义或可见元素：admin_username"
  };

  const summary = buildDeveloperHandoffSummary({
    runId: "run_b",
    caseId: "case_b",
    env: "sit",
    failedStep,
    artifacts: {}
  });

  assert.equal(summary?.ownerHint, "frontend");
  assert.equal(summary?.category, "locator_or_ui_change");
  assert.match(summary?.suggestedAction ?? "", /页面元素|定位/);
});
