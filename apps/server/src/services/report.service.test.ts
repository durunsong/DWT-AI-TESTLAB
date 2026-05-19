import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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
