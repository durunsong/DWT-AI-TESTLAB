import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveScreenshotPath } from "./ai-screenshot";

const rootDir = path.resolve("D:/Dowsure/dwt-testing");

test("resolves screenshot absolute path inside screenshots folder", () => {
  const resolved = resolveScreenshotPath(rootDir, path.resolve(rootDir, "screenshots/0001_login/user.png"));

  assert.equal(resolved, path.resolve(rootDir, "screenshots/0001_login/user.png"));
});

test("resolves public screenshots url into local path", () => {
  const resolved = resolveScreenshotPath(rootDir, "/screenshots/0001_login/user.png");

  assert.equal(resolved, path.resolve(rootDir, "screenshots/0001_login/user.png"));
});

test("rejects path outside screenshots folder", () => {
  assert.throws(() => resolveScreenshotPath(rootDir, path.resolve(rootDir, ".env")), /截图文件必须位于/);
});
