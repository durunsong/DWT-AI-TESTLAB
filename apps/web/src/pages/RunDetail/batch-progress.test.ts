import assert from "node:assert/strict";
import test from "node:test";
import type { BatchTestRunSummary } from "../../types/run";
import { buildBatchProgressView } from "./batch-progress";

test("marks current progress as exception when the only batch item failed", () => {
  const view = buildBatchProgressView(
    batch({
      status: "failed",
      total: 1,
      failed: 1,
      items: [{ caseId: "admin_zilikaoxiugai002", caseName: "admin profile update", caseType: "admin-main", status: "failed" }]
    })
  );

  assert.equal(view.completed, 1);
  assert.equal(view.totalPercent, 100);
  assert.equal(view.totalStatus, "exception");
  assert.equal(view.currentText, "1/1");
  assert.equal(view.currentPercent, 100);
  assert.equal(view.currentStatus, "exception");
});

function batch(overrides: Partial<BatchTestRunSummary>): BatchTestRunSummary {
  return {
    batchId: "batch_1",
    env: "local",
    status: "running",
    total: 1,
    passed: 0,
    failed: 0,
    running: 0,
    pending: 0,
    startedAt: "2026-05-26T00:00:00.000Z",
    items: [],
    ...overrides
  };
}
