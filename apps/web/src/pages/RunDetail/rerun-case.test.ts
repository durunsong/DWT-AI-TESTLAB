import assert from "node:assert/strict";
import test from "node:test";
import { buildRerunCaseRequest, canRerunCase } from "./rerun-case";
import type { TestRunSummary } from "../../types/run";

const baseRun: TestRunSummary = {
  runId: "0001_demo",
  caseId: "admin_login",
  env: "local",
  status: "failed",
  total: 1,
  passed: 0,
  failed: 1,
  skipped: 0,
  startedAt: "2026-05-25T07:59:21.707Z",
  steps: [],
  reportLinks: {}
};

test("can rerun only failed runs with case and env", () => {
  assert.equal(canRerunCase(baseRun), true);
  assert.equal(canRerunCase({ ...baseRun, status: "passed" }), false);
  assert.equal(canRerunCase({ ...baseRun, caseId: "" }), false);
  assert.equal(canRerunCase({ ...baseRun, env: "" }), false);
  assert.equal(canRerunCase(undefined), false);
});

test("builds rerun request from the failed run context", () => {
  assert.deepEqual(buildRerunCaseRequest(baseRun), {
    caseId: "admin_login",
    env: "local"
  });
});

test("rejects rerun request when the run is not eligible", () => {
  assert.throws(() => buildRerunCaseRequest({ ...baseRun, status: "running" }), /当前运行记录不能重新执行/);
});
