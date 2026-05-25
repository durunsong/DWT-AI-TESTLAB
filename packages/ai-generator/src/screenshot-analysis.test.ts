import assert from "node:assert/strict";
import test from "node:test";
import { buildFailureAnalysisMessages, buildScreenshotAnalysisMessages } from "./screenshot-analysis";

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

test("asks failure analysis to use API request parameters and action diagnostics", () => {
  const messages = buildFailureAnalysisMessages({
    runId: "run_1",
    caseId: "admin_login",
    env: "local",
    failedStep: {
      stepId: "click_login",
      error: "登录失败",
      data: {
        diagnostics: {
          recentActionDiagnostics: [{
            kind: "input_value",
            target: "admin_login_username",
            protected: false,
            matched: false,
            expectedValue: "admin@example.com",
            actualValue: "admin@example.com2124"
          }],
          recentApiResponses: [{
            method: "POST",
            url: "/login",
            status: 200,
            statusText: "OK",
            ok: true,
            requestPostData: "{\"username\":\"admin@example.com2124\",\"password\":\"******\"}",
            bodyText: "{\"code\":\"401\"}",
            matchedAt: "2026-05-23T00:00:00.000Z"
          }]
        }
      }
    }
  });

  const payload = JSON.stringify(messages);
  assert.match(payload, /接口请求参数/);
  assert.match(payload, /动作诊断/);
  assert.match(payload, /人工干预/);
  assert.match(payload, /账号类测试入参可明文比对/);
  assert.match(payload, /admin@example\.com2124/);
});

test("asks failure analysis to include developer handoff fields", () => {
  const messages = buildFailureAnalysisMessages({
    runId: "run_1",
    caseId: "case_1",
    env: "local",
    failedStep: {
      stepId: "click_save",
      error: "接口业务码不符合预期"
    }
  });

  const payload = JSON.stringify(messages);
  assert.match(payload, /开发处理摘要/);
  assert.match(payload, /建议处理人/);
  assert.match(payload, /复现方式/);
});
