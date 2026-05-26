import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaseItem } from "../../types/case";
import type { RunHistoryItem } from "../../types/report";
import { deriveCaseHealth } from "./case-health";

test("deriveCaseHealth marks invalid cases as needing repair before execution history", () => {
  const health = deriveCaseHealth(caseItem({ valid: false }), [run("failed")]);

  assert.equal(health.tone, "error");
  assert.equal(health.label, "需修复");
  assert.equal(health.description, "DSL 校验未通过，暂不可执行。");
});

test("deriveCaseHealth marks runnable cases without history as unverified", () => {
  const health = deriveCaseHealth(caseItem(), []);

  assert.equal(health.tone, "warning");
  assert.equal(health.label, "未运行");
  assert.equal(health.description, "还没有历史结果，建议先做一次预检或冒烟执行。");
});

test("deriveCaseHealth uses latest run and remembers recovered failures", () => {
  const failedThenPassed = [run("passed", "run-2", "2026-05-26T10:00:00.000Z"), run("failed", "run-1", "2026-05-25T10:00:00.000Z")];

  assert.deepEqual(deriveCaseHealth(caseItem(), failedThenPassed), {
    tone: "warning",
    label: "已恢复",
    description: "最近一次已通过，但近 2 次内出现过失败。"
  });
});

function caseItem(patch: Partial<CaseItem> = {}): CaseItem {
  return {
    caseId: "login_user",
    caseName: "用户登录",
    caseType: "smoke",
    mode: "web",
    total: 3,
    valid: true,
    ...patch
  };
}

function run(
  status: RunHistoryItem["status"],
  runId = `run-${status}`,
  startedAt = "2026-05-26T10:00:00.000Z"
): RunHistoryItem {
  return {
    runId,
    caseId: "login_user",
    caseName: "用户登录",
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
