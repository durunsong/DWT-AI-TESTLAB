import assert from "node:assert/strict";
import test from "node:test";
import type { RunHistoryItem } from "../services/report.service";
import { mergeRunningRunIntoHistory } from "./test-runs.routes";

const historyItem: RunHistoryItem = {
  runId: "0001_done",
  caseId: "done_case",
  caseName: "Done Case",
  env: "local",
  status: "passed",
  startedAt: "2026-05-20T08:00:00.000Z",
  endedAt: "2026-05-20T08:01:00.000Z",
  durationMs: 60000,
  total: 1,
  passed: 1,
  failed: 0,
  skipped: 0,
  reportLinks: {
    html: "/reports/0001_done.html",
    json: "/api/test-runs/0001_done/report",
    logs: "/api/test-runs/0001_done/logs"
  }
};

test("history includes the latest running run before persisted reports", () => {
  const history = mergeRunningRunIntoHistory([historyItem], {
    runId: "0002_running",
    caseId: "running_case",
    caseName: "Running Case",
    env: "local",
    status: "running",
    startedAt: "2026-05-20T09:00:00.000Z",
    total: 2,
    passed: 1,
    failed: 0,
    skipped: 0,
    steps: [],
    reportLinks: {
      html: "/reports/0002_running.html",
      json: "/api/test-runs/0002_running/report",
      logs: "/api/test-runs/0002_running/logs"
    }
  });

  assert.deepEqual(history.map((item) => `${item.runId}:${item.status}`), [
    "0002_running:running",
    "0001_done:passed"
  ]);
});

test("history does not duplicate the latest run after it has been persisted", () => {
  const history = mergeRunningRunIntoHistory([historyItem], {
    ...historyItem,
    steps: [],
    reportLinks: {
      ...historyItem.reportLinks,
      screenshots: "/screenshots/0001_done",
      traces: "/traces/0001_done"
    }
  });

  assert.deepEqual(history.map((item) => item.runId), ["0001_done"]);
});
