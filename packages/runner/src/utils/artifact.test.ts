import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultPlatformConfig } from "../config/platform-config";
import { createArtifactPaths } from "./artifact";

test("creates artifact paths from configured directories", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-artifacts-"));
  const artifacts = await createArtifactPaths(rootDir, "0001_case", {
    ...defaultPlatformConfig,
    artifacts: {
      logsDir: "runtime/logs",
      reportsDir: "runtime/reports",
      screenshotsDir: "runtime/screenshots",
      tracesDir: "runtime/traces"
    }
  });

  assert.equal(artifacts.logFile, path.join(rootDir, "runtime/logs/0001_case.log"));
  assert.equal(artifacts.jsonReport, path.join(rootDir, "runtime/reports/0001_case.json"));
  assert.equal(artifacts.screenshotsDir, path.join(rootDir, "runtime/screenshots/0001_case"));
  assert.equal(artifacts.tracesDir, path.join(rootDir, "runtime/traces/0001_case"));
});
