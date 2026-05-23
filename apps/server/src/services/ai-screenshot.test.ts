import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { defaultPlatformConfig } from "@ai-e2e/runner";
import { resolveScreenshotPath } from "./ai-screenshot";

const rootDir = process.cwd();

test("resolves screenshot absolute path inside screenshots folder", () => {
  const resolved = resolveScreenshotPath(rootDir, path.resolve(rootDir, "screenshots/0001_login/user.png"));

  assert.equal(resolved, path.resolve(rootDir, "screenshots/0001_login/user.png"));
});

test("resolves public screenshots url into local path", () => {
  const resolved = resolveScreenshotPath(rootDir, "/screenshots/0001_login/user.png");

  assert.equal(resolved, path.resolve(rootDir, "screenshots/0001_login/user.png"));
});

test("resolves public screenshots url with configured screenshot directory", () => {
  const resolved = resolveScreenshotPath(rootDir, "/screenshots/0001_login/user.png", {
    ...defaultPlatformConfig,
    artifacts: { ...defaultPlatformConfig.artifacts, screenshotsDir: "runtime/screenshots" }
  });

  assert.equal(resolved, path.resolve(rootDir, "runtime/screenshots/0001_login/user.png"));
});

test("rejects path outside screenshots folder", () => {
  assert.throws(() => resolveScreenshotPath(rootDir, path.resolve(rootDir, ".env")), /截图文件必须位于/);
});
