import assert from "node:assert/strict";
import test from "node:test";
import { readReportViewMode } from "./report-view-mode";

test("accepts traces as a report view mode", () => {
  assert.equal(readReportViewMode("traces"), "traces");
});

test("accepts videos as a report view mode", () => {
  assert.equal(readReportViewMode("videos"), "videos");
});

test("accepts AI analysis as a report view mode", () => {
  assert.equal(readReportViewMode("ai-analysis"), "ai-analysis");
});

test("falls back to overview for unknown report view mode", () => {
  assert.equal(readReportViewMode("unknown"), "overview");
  assert.equal(readReportViewMode(null), "overview");
});
