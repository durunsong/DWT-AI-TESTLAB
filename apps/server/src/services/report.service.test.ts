import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunReport } from "@ai-e2e/shared";
import { ReportService } from "./report.service";

test("deletes artifacts for one run history item", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-report-delete-"));
  for (const dir of ["reports", "logs", "screenshots/run_a", "screenshots/run_b", "traces/run_a", "traces/run_b"]) {
    await fs.mkdir(path.join(rootDir, dir), { recursive: true });
  }
  await fs.writeFile(path.join(rootDir, "reports", "run_a.json"), "{}", "utf8");
  await fs.writeFile(path.join(rootDir, "reports", "run_a.html"), "<html></html>", "utf8");
  await fs.writeFile(path.join(rootDir, "reports", "run_b.json"), "{}", "utf8");
  await fs.writeFile(path.join(rootDir, "logs", "run_a.log"), "log", "utf8");
  await fs.writeFile(path.join(rootDir, "logs", "run_b.log"), "log", "utf8");
  await fs.writeFile(path.join(rootDir, "screenshots", "run_a", "failed.png"), "png", "utf8");
  await fs.writeFile(path.join(rootDir, "traces", "run_a", "trace.zip"), "zip", "utf8");

  const service = new ReportService(rootDir);
  const result = await service.deleteRunHistory("run_a");

  assert.equal(result.deleted, true);
  assert.equal(result.runId, "run_a");
  await assert.rejects(() => fs.stat(path.join(rootDir, "reports", "run_a.json")));
  await assert.rejects(() => fs.stat(path.join(rootDir, "logs", "run_a.log")));
  await assert.rejects(() => fs.stat(path.join(rootDir, "screenshots", "run_a")));
  await assert.rejects(() => fs.stat(path.join(rootDir, "traces", "run_a")));
  await assert.doesNotReject(() => fs.stat(path.join(rootDir, "reports", "run_b.json")));
  await assert.doesNotReject(() => fs.stat(path.join(rootDir, "logs", "run_b.log")));
});

test("reads latest run summary and log from report history", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-report-latest-"));
  await fs.mkdir(path.join(rootDir, "reports"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "logs"), { recursive: true });

  await writeReport(rootDir, {
    runId: "001_old_case",
    caseId: "old_case",
    caseName: "旧用例",
    env: "test",
    status: "passed",
    startedAt: "2026-05-18T08:00:00.000Z",
    endedAt: "2026-05-18T08:01:00.000Z",
    durationMs: 60000,
    total: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    steps: [],
    artifacts: {}
  });
  await writeReport(rootDir, {
    runId: "002_new_case",
    caseId: "new_case",
    caseName: "新用例",
    env: "test",
    status: "failed",
    startedAt: "2026-05-19T08:00:00.000Z",
    endedAt: "2026-05-19T08:01:00.000Z",
    durationMs: 60000,
    total: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
    steps: [],
    artifacts: {}
  });
  await fs.writeFile(path.join(rootDir, "logs", "002_new_case.log"), "latest log", "utf8");

  const service = new ReportService(rootDir);
  const summary = await service.readRunSummary("latest");
  const log = await service.readLog("latest");

  assert.equal(summary.runId, "002_new_case");
  assert.equal(summary.caseId, "new_case");
  assert.equal(summary.reportLinks.html, "/reports/002_new_case.html");
  assert.equal(log, "latest log");
});

async function writeReport(rootDir: string, report: RunReport): Promise<void> {
  await fs.writeFile(path.join(rootDir, "reports", `${report.runId}.json`), JSON.stringify(report), "utf8");
}
