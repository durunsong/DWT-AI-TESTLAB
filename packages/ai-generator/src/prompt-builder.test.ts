import assert from "node:assert/strict";
import test from "node:test";
import { buildMaterialCaseGenerationPrompt } from "./prompt-builder";

test("adds selected reusable abilities to material case generation prompt", () => {
  const prompt = buildMaterialCaseGenerationPrompt({
    caseId: "kyc_submit_copy",
    caseName: "KYC 提交复用能力",
    requirement: "生成用户提交 KYC 的主流程",
    materials: [],
    sharedAbilities: [
      {
        sharedId: "common/web_login",
        name: "登录复用流程",
        description: "打开登录页并执行登录",
        params: [
          { name: "session", required: true },
          { name: "url", defaultValue: "${session.login_url}" }
        ],
        stepCount: 2,
        file: "cases/shared/common/web_login.yaml"
      }
    ]
  });

  assert.match(prompt, /可复用能力/);
  assert.match(prompt, /common\/web_login/);
  assert.match(prompt, /use: common\/web_login/);
  assert.match(prompt, /with:/);
  assert.match(prompt, /session/);
});
