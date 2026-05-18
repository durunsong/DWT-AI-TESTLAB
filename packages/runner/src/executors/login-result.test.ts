import assert from "node:assert/strict";
import test from "node:test";
import { buildLoginStillPendingMessage, isLoginUrl } from "./login-result";

test("detects hash login url", () => {
  assert.equal(isLoginUrl("http://localhost:5173/user/#/login"), true);
  assert.equal(isLoginUrl("http://localhost:5173/admin/#/admin/login"), true);
});

test("does not treat dashboard as login url", () => {
  assert.equal(isLoginUrl("http://localhost:5173/user/#/dashboard"), false);
});

test("builds actionable login pending message", () => {
  const message = buildLoginStillPendingMessage("user", "http://localhost:5173/user/#/login");
  assert.match(message, /user 登录提交后仍停留在登录页/);
  assert.match(message, /验证码/);
});
