import assert from "node:assert/strict";
import test from "node:test";
import { buildSharedAbilityOptions, summarizeSelectedSharedAbilities } from "./shared-abilities";
import type { SharedAbility } from "../../types/case";

const abilities: SharedAbility[] = [
  {
    sharedId: "kyc/submit",
    name: "KYC 提交",
    description: "用户端提交 KYC",
    tags: ["kyc"],
    params: [],
    stepCount: 1,
    file: "cases/shared/kyc/submit.yaml"
  },
  {
    sharedId: "common/web_login",
    name: "登录复用流程",
    description: "打开登录页并执行登录",
    tags: ["login"],
    params: [{ name: "session", required: true }],
    stepCount: 2,
    file: "cases/shared/common/web_login.yaml"
  }
];

test("builds shared ability options sorted by shared id", () => {
  assert.deepEqual(buildSharedAbilityOptions(abilities).map((item) => item.value), [
    "common/web_login",
    "kyc/submit"
  ]);
});

test("builds rich searchable text for shared ability dropdown options", () => {
  const [option] = buildSharedAbilityOptions(abilities);

  assert.equal(option?.description, "打开登录页并执行登录");
  assert.equal(option?.stepCount, 2);
  assert.match(option?.searchText ?? "", /common\/web_login/);
  assert.match(option?.searchText ?? "", /登录复用流程/);
  assert.match(option?.searchText ?? "", /session/);
  assert.match(option?.searchText ?? "", /cases\/shared\/common\/web_login\.yaml/);
});

test("summarizes selected shared abilities for AI input", () => {
  assert.deepEqual(summarizeSelectedSharedAbilities(abilities, ["common/web_login"]), [
    abilities[1]
  ]);
});
