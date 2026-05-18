import assert from "node:assert/strict";
import test from "node:test";
import { createLocatorPlans } from "./locator-candidates";

test("keeps testId first while preserving fallback candidates", () => {
  const plans = createLocatorPlans({
    testId: "user-login-username",
    fallback: [
      { placeholder: "请输入账号" },
      { placeholder: "请输入您的手机号或邮箱" },
      { name: "username" }
    ]
  });

  assert.deepEqual(plans.map((plan) => plan.kind), ["testId", "placeholder", "placeholder", "name"]);
  assert.equal(plans[1]?.value, "请输入账号");
  assert.equal(plans[2]?.value, "请输入您的手机号或邮箱");
});

test("supports direct fields before fallback fields", () => {
  const plans = createLocatorPlans({
    placeholder: "请输入登录密码",
    fallback: [{ text: "登录" }]
  });

  assert.deepEqual(plans.map((plan) => plan.kind), ["placeholder", "text"]);
});
