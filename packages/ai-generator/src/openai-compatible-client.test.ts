import assert from "node:assert/strict";
import test from "node:test";
import { AiClientError, buildAuthorizationHeader, buildFetchFailureMessage, normalizeBaseUrl, OpenAiCompatibleClient } from "./openai-compatible-client";

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

test("retries retryable HTTP failures and returns usage metadata", async () => {
  let attempts = 0;
  const client = new OpenAiCompatibleClient({
    baseUrl: "https://ai.example/v1",
    apiKey: "test-key",
    model: "test-model",
    maxRetries: 1,
    retryDelayMs: 1,
    fetch: async () => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse({ error: { message: "too many requests" } }, { status: 429 });
      }
      return jsonResponse({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 }
      });
    }
  });

  const result = await client.chatWithMetadata([{ role: "user", content: "ping" }]);

  assert.equal(result.content, "ok");
  assert.equal(attempts, 2);
  assert.deepEqual(result.usage, { promptTokens: 3, completionTokens: 5, totalTokens: 8 });
});

test("does not retry authentication failures", async () => {
  let attempts = 0;
  const client = new OpenAiCompatibleClient({
    baseUrl: "https://ai.example/v1",
    apiKey: "test-key",
    model: "test-model",
    maxRetries: 3,
    retryDelayMs: 1,
    fetch: async () => {
      attempts += 1;
      return jsonResponse({ error: { message: "bad key" } }, { status: 401 });
    }
  });

  await assert.rejects(
    () => client.chat([{ role: "user", content: "ping" }]),
    (error) => error instanceof AiClientError
      && error.category === "auth"
      && error.retryable === false
      && attempts === 1
  );
});

test("classifies empty AI responses as invalid response", async () => {
  const client = new OpenAiCompatibleClient({
    baseUrl: "https://ai.example/v1",
    apiKey: "test-key",
    model: "test-model",
    fetch: async () => jsonResponse({ choices: [] })
  });

  await assert.rejects(
    () => client.chat([{ role: "user", content: "ping" }]),
    (error) => error instanceof AiClientError && error.category === "invalid_response"
  );
});

test("classifies request timeout", async () => {
  const client = new OpenAiCompatibleClient({
    baseUrl: "https://ai.example/v1",
    apiKey: "test-key",
    model: "test-model",
    timeoutMs: 1,
    maxRetries: 0,
    fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })
  });

  await assert.rejects(
    () => client.chat([{ role: "user", content: "ping" }]),
    (error) => error instanceof AiClientError && error.category === "timeout"
  );
});

test("streaming keeps generated content when provider closes without DONE", async () => {
  const client = new OpenAiCompatibleClient({
    baseUrl: "https://ai.example/v1",
    apiKey: "test-key",
    model: "test-model",
    fetch: async () => new Response([
      "data: {\"choices\":[{\"delta\":{\"content\":\"你\"}}]}\n\n",
      "data: {\"choices\":[{\"delta\":{\"content\":\"好\"}}]}\n\n"
    ].join(""))
  });

  const chunks: string[] = [];
  for await (const chunk of client.chatStream([{ role: "user", content: "ping" }])) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ["你", "好"]);
});

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
}
