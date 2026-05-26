import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBatchReportDetailPath, buildBatchReportModePath } from "./batch-report-links";

test("buildBatchReportDetailPath routes detail to report overview", () => {
  assert.equal(
    buildBatchReportDetailPath({ runId: "0001_admin_zilkiaoxiugai001_mpm4rsdpd5cb", fallbackRunId: "latest" }),
    "/reports/0001_admin_zilkiaoxiugai001_mpm4rsdpd5cb"
  );
});

test("buildBatchReportDetailPath falls back to latest report overview", () => {
  assert.equal(buildBatchReportDetailPath({ fallbackRunId: "latest" }), "/reports/latest");
});

test("buildBatchReportModePath routes logs through report viewer instead of API log endpoint", () => {
  assert.equal(
    buildBatchReportModePath("logs", { runId: "0001_admin_zilkiaoxiugai001_mpm4rsdpd5cb", fallbackRunId: "latest" }),
    "/reports/0001_admin_zilkiaoxiugai001_mpm4rsdpd5cb?mode=logs"
  );
});

test("buildBatchReportModePath falls back to latest while the batch row has no run id yet", () => {
  assert.equal(
    buildBatchReportModePath("logs", { fallbackRunId: "latest" }),
    "/reports/latest?mode=logs"
  );
});
