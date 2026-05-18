import assert from "node:assert/strict";
import test from "node:test";
import { buildScreenshotAnalysisMessages } from "./screenshot-analysis";

test("builds multimodal screenshot analysis messages with error context", () => {
  const messages = buildScreenshotAnalysisMessages({
    imageDataUrl: "data:image/png;base64,abc",
    stepId: "user_login",
    error: "仍停留在登录页"
  });

  assert.equal(messages[0]?.role, "system");
  assert.equal(messages[1]?.role, "user");
  assert.ok(Array.isArray(messages[1]?.content));
  assert.match(JSON.stringify(messages), /user_login/);
  assert.match(JSON.stringify(messages), /仍停留在登录页/);
  assert.match(JSON.stringify(messages), /data:image\/png;base64,abc/);
});
