import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaseItem } from "../../types/case";
import type { RunHistoryItem } from "../../types/report";
import { buildQualityOverview } from "./quality-overview";

const cases: CaseItem[] = [
  { caseId: "login_user", caseName: "用户登录", caseType: "smoke", mode: "web", total: 3, valid: true },
  { caseId: "kyc_submit", caseName: "KYC 提交", caseType: "kyc", mode: "hybrid", total: 9, valid: true },
  { caseId: "broken_yaml", caseName: "错误 YAML", caseType: "smoke", mode: "web", total: 0, valid: false },
  { caseId: "never_run", caseName: "未运行用例", caseType: "smoke", mode: "web", total: 2, valid: true }
];

const history: RunHistoryItem[] = [
  run("run-4", "kyc_submit", "KYC 提交", "failed", "2026-05-26T10:00:00.000Z"),
  run("run-3", "login_user", "用户登录", "passed", "2026-05-26T09:00:00.000Z"),
  run("run-2", "kyc_submit", "KYC 提交", "failed", "2026-05-25T09:00:00.000Z"),
  run("run-1", "login_user", "用户登录", "passed", "2026-05-24T09:00:00.000Z")
];

test("buildQualityOverview summarizes runnable assets and recent pass rate", () => {
  const overview = buildQualityOverview(cases, history);

  assert.equal(overview.totalCases, 4);
  assert.equal(overview.runnableCases, 3);
  assert.equal(overview.invalidCases, 1);
  assert.equal(overview.unrunRunnableCases, 1);
  assert.equal(overview.completedRuns, 4);
  assert.equal(overview.passRateText, "50.0%");
});

test("buildQualityOverview ranks failed cases and recommends focused action", () => {
  const overview = buildQualityOverview(cases, history);

  assert.deepEqual(overview.topFailedCases, [
    { caseId: "kyc_submit", caseName: "KYC 提交", failures: 2, latestRunId: "run-4" }
  ]);
  assert.equal(overview.recommendationTone, "error");
  assert.equal(overview.recommendation, "优先处理 1 个最近失败用例，避免继续扩大回归噪音。");
});

function run(
  runId: string,
  caseId: string,
  caseName: string,
  status: RunHistoryItem["status"],
  startedAt: string
): RunHistoryItem {
  return {
    runId,
    caseId,
    caseName,
    env: "sit",
    status,
    startedAt,
    total: 3,
    passed: status === "passed" ? 3 : 2,
    failed: status === "failed" ? 1 : 0,
    skipped: 0,
    reportLinks: {
      html: `/reports/${runId}.html`,
      json: `/api/test-runs/${runId}/report`,
      logs: `/api/test-runs/${runId}/logs`
    }
  };
}
