import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadPlatformConfig, resolveArtifactBaseDir } from "./platform-config";

test("loads configurable platform fields with defaults", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-platform-config-"));
  await fs.writeFile(
    path.join(rootDir, "platform.config.json"),
    JSON.stringify({
      web: { requestTimeoutMs: 120000, storageKey: "team-settings" },
      artifacts: { reportsDir: "runtime/reports" },
      browser: { defaultViewport: { width: 1600, height: 900 } }
    }),
    "utf8"
  );

  const config = loadPlatformConfig(rootDir);

  assert.equal(config.web.requestTimeoutMs, 120000);
  assert.equal(config.web.storageKey, "team-settings");
  assert.equal(config.artifacts.reportsDir, "runtime/reports");
  assert.equal(config.artifacts.logsDir, "logs");
  assert.deepEqual(config.browser.defaultViewport, { width: 1600, height: 900 });
});

test("rejects artifact directories outside workspace root", () => {
  const rootDir = path.resolve(os.tmpdir(), "dwt-platform-config-root");
  const config = loadPlatformConfig();
  const unsafeConfig = {
    ...config,
    artifacts: { ...config.artifacts, reportsDir: "../reports" }
  };

  assert.throws(() => resolveArtifactBaseDir(rootDir, unsafeConfig, "reports"), /配置目录必须位于项目根目录内/);
});
