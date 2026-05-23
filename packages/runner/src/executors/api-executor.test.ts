import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuntimeContextState } from "@ai-e2e/shared";
import { ApiExecutor } from "./api-executor";

describe("ApiExecutor", () => {
  it("runs api_request with query, json body and variable extraction", async () => {
    const saved: Record<string, string> = {};
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const executor = new ApiExecutor({
      context: { state: state({ enterprise_id: "E1001" }), setVariable: (key, value) => { saved[key] = value; } },
      fetch: async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse(String(input), { code: "0000", data: { id: 42, status: "OK" } });
      },
      now: () => "2026-05-21T00:00:00.000Z"
    });

    const result = await executor.execute({
      step_id: "api_create",
      name: "create",
      type: "api_request",
      url: "https://example.test/api/create",
      method: "post",
      headers: { Authorization: "Bearer ${var.enterprise_id}" },
      query: { env: "sit", page: 1, empty: null },
      body: { enterpriseId: "${var.enterprise_id}" },
      body_path: "data.id",
      save_as: "created_id"
    });

    assert.equal(calls[0]?.url, "https://example.test/api/create?env=sit&page=1");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.equal((calls[0]?.init?.headers as Record<string, string>)["content-type"], "application/json");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ enterpriseId: "E1001" }));
    assert.equal(saved.created_id, "42");
    assert.match(result.message ?? "", /API 请求完成/);
  });

  it("asserts response fields and business code", async () => {
    const executor = new ApiExecutor({
      context: { state: state(), setVariable: () => undefined },
      fetch: async (input) => jsonResponse(String(input), { code: "0000", data: { status: "APPROVED" } })
    });

    await assert.doesNotReject(() => executor.execute({
      step_id: "api_assert",
      name: "assert",
      type: "api_assert",
      url: "https://example.test/api/detail",
      expected_status: 200,
      business_code_path: "code",
      success_codes: ["0000"],
      expected: { "data.status": "APPROVED" }
    }));
  });

  it("throws with api diagnostic when assertion fails", async () => {
    const executor = new ApiExecutor({
      context: { state: state(), setVariable: () => undefined },
      fetch: async (input) => jsonResponse(String(input), { code: "9999", message: "failed" })
    });

    await assert.rejects(
      () => executor.execute({
        step_id: "api_assert",
        name: "assert",
        type: "api_assert",
        url: "https://example.test/api/detail",
        business_code_path: "code",
        success_codes: ["0000"]
      }),
      (error) => {
        assert.match((error as Error).message, /API 业务码不符合预期/);
        assert.equal((error as { apiDiagnostic?: { status: number } }).apiDiagnostic?.status, 200);
        return true;
      }
    );
  });

  it("resolves relative URL from API_BASE_URL", async () => {
    const previous = process.env.API_BASE_URL;
    process.env.API_BASE_URL = "https://api.example.test/base/";
    try {
      const calls: string[] = [];
      const executor = new ApiExecutor({
        context: { state: state(), setVariable: () => undefined },
        fetch: async (input) => {
          calls.push(String(input));
          return jsonResponse(String(input), { code: "0000" });
        }
      });

      await executor.execute({
        step_id: "relative",
        name: "relative",
        type: "api_request",
        url: "/users"
      });

      assert.equal(calls[0], "https://api.example.test/users");
    } finally {
      if (previous === undefined) {
        delete process.env.API_BASE_URL;
      } else {
        process.env.API_BASE_URL = previous;
      }
    }
  });

  it("reuses browser session cookie when api step has session", async () => {
    const calls: Array<{ init?: RequestInit }> = [];
    const executor = new ApiExecutor({
      context: { state: state(), setVariable: () => undefined },
      sessionCookieHeader: async () => "sid=abc; theme=dark",
      fetch: async (input, init) => {
        calls.push({ init });
        return jsonResponse(String(input), { code: "0000" });
      }
    });

    await executor.execute({
      step_id: "api_with_cookie",
      name: "api with cookie",
      type: "api_request",
      session: "user",
      url: "https://example.test/api/me"
    });

    assert.equal((calls[0]?.init?.headers as Record<string, string>).cookie, "sid=abc; theme=dark");
  });
});

function jsonResponse(url: string, body: unknown, init: ResponseInit = {}): Response {
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function state(variables: Record<string, string> = {}): RuntimeContextState {
  return {
    runId: "run_test",
    env: "local",
    timestamp: "2026-05-21T00:00:00.000Z",
    variables,
    scenario: {
      case_id: "api_case",
      case_name: "API case",
      mode: "hybrid",
      sessions: [],
      locations: { file: "cases/location/login.user.yaml" },
      steps: []
    },
    sessions: {
      user: {
        name: "user",
        login_url: "https://web.example.test/login"
      }
    }
  };
}
