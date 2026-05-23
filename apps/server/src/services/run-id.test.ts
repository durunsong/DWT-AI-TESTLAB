import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultPlatformConfig } from "@ai-e2e/runner";
import { createNextRunId, formatRunId, getNextRunSequence } from "./run-id";

test("gets next sequence from existing numbered run folders", () => {
  assert.equal(getNextRunSequence(["0001_login_user_ab12", "0007_login_admin_cd34", "run_old"]), 8);
});

test("uses first sequence when there are no numbered run folders", () => {
  assert.equal(getNextRunSequence(["run_old", "notes"]), 1);
});

test("formats run id with four digit sequence and safe case id", () => {
  const runId = formatRunId(12, "login/user");

  assert.match(runId, /^0012_login_user_[0-9a-z]+$/);
});

test("creates next run id from configured artifact directories", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-run-id-"));
  const config = {
    ...defaultPlatformConfig,
    artifacts: {
      ...defaultPlatformConfig.artifacts,
      screenshotsDir: "runtime/screenshots",
      reportsDir: "runtime/reports",
      logsDir: "runtime/logs"
    }
  };
  await fs.mkdir(path.join(rootDir, "runtime/screenshots"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "runtime/screenshots", "0009_old_case"), "", "utf8");

  const runId = await createNextRunId(rootDir, "new/case", config);

  assert.match(runId, /^0010_new_case_[0-9a-z]+$/);
});
