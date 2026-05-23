import assert from "node:assert/strict";
import test from "node:test";
import { createCaseListCopyMeta } from "./case-list-copy";

test("builds copy metadata for caseId and case name", () => {
  assert.deepEqual(createCaseListCopyMeta("caseId", "login_user"), {
    title: "点击复制 caseId：login_user",
    successMessage: "caseId 已复制"
  });
  assert.deepEqual(createCaseListCopyMeta("caseName", "user 登录流程"), {
    title: "点击复制名称：user 登录流程",
    successMessage: "名称已复制"
  });
});
