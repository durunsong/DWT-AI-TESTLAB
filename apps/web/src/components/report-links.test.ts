import assert from "node:assert/strict";
import test from "node:test";
import { buildReportModePath } from "./report-links";

test("routes trace entry to the selected run report view", () => {
  assert.equal(buildReportModePath("traces", "0007_demo"), "/reports/0007_demo?mode=traces");
});

test("routes normal report modes to the selected run report view", () => {
  assert.equal(buildReportModePath("html", "0007_demo"), "/reports/0007_demo?mode=html");
  assert.equal(buildReportModePath("screenshots", "0007_demo"), "/reports/0007_demo?mode=screenshots");
});

test("routes AI analysis entry to the selected run report view", () => {
  assert.equal(buildReportModePath("ai-analysis", "0007_demo"), "/reports/0007_demo?mode=ai-analysis");
});
