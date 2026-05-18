import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthorizationHeader, buildFetchFailureMessage, normalizeBaseUrl } from "./openai-compatible-client";

test("adds Bearer prefix when api key is raw", () => {
  assert.equal(buildAuthorizationHeader("abc123"), "Bearer abc123");
});

test("keeps Bearer prefix when api key already contains it", () => {
  assert.equal(buildAuthorizationHeader("Bearer abc123"), "Bearer abc123");
});

test("normalizes base url by removing trailing slash", () => {
  assert.equal(normalizeBaseUrl("https://example.com/v1/"), "https://example.com/v1");
});

test("builds actionable network failure message without leaking api key", () => {
  const message = buildFetchFailureMessage(
    "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    new Error("fetch failed", { cause: Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }) })
  );

  assert.match(message, /AI 请求网络失败/);
  assert.match(message, /token-plan\.cn-beijing\.maas\.aliyuncs\.com/);
  assert.match(message, /AI_BASE_URL/);
  assert.doesNotMatch(message, /sk-/);
});
