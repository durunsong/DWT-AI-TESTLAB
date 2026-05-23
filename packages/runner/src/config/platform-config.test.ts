import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { defaultPlatformConfig, loadPlatformConfig, resolveArtifactBaseDir } from "./platform-config";

test("defaults to loopback-only server exposure", () => {
  assert.equal(defaultPlatformConfig.server.host, "127.0.0.1");
  assert.deepEqual(defaultPlatformConfig.server.corsOrigins, [
    "http://127.0.0.1:4301",
    "http://localhost:4301"
  ]);
});

test("loads configurable platform fields with defaults", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "dwt-platform-config-"));
  await fs.writeFile(
    path.join(rootDir, "platform.config.json"),
    JSON.stringify({
      web: { requestTimeoutMs: 120000, storageKey: "team-settings" },
      desktop: { window: { menuBarVisible: false } },
      artifacts: { reportsDir: "runtime/reports" },
      browser: { defaultViewport: { width: 1600, height: 900 } },
      uploads: { caseAttachmentMaxMb: 32, caseAttachmentBaseDir: "uploads/test-cases" }
    }),
    "utf8"
  );

  const config = loadPlatformConfig(rootDir);

  assert.equal(config.web.requestTimeoutMs, 120000);
  assert.equal(config.web.storageKey, "team-settings");
  assert.equal(config.desktop.window.menuBarVisible, false);
  assert.equal(config.artifacts.reportsDir, "runtime/reports");
  assert.equal(config.artifacts.logsDir, "logs");
  assert.deepEqual(config.browser.defaultViewport, { width: 1600, height: 900 });
  assert.equal(config.uploads.caseAttachmentMaxMb, 32);
  assert.equal(config.uploads.caseAttachmentBaseDir, "uploads/test-cases");
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
