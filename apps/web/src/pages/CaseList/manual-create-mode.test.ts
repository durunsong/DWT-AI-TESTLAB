import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveManualCreateMode } from "./manual-create-mode";

test("resolveManualCreateMode requires a source case when copying", () => {
  assert.deepEqual(resolveManualCreateMode({ manualSource: "copy", sourceCaseId: "" }), {
    kind: "invalid",
    message: "请选择一个可用的用例来源"
  });
});

test("resolveManualCreateMode allows copying from an existing source case", () => {
  assert.deepEqual(resolveManualCreateMode({ manualSource: "copy", sourceCaseId: "login_user" }), {
    kind: "copy",
    sourceCaseId: "login_user"
  });
});

test("resolveManualCreateMode falls back to built-in template when requested", () => {
  assert.deepEqual(resolveManualCreateMode({ manualSource: "builtin", sourceCaseId: "" }), {
    kind: "builtin"
  });
});
