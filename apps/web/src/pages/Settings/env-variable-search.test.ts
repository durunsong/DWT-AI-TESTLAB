import assert from "node:assert/strict";
import test from "node:test";
import { filterEnvVariables } from "./env-variable-search";
import type { EnvVariable } from "../../types/settings";

const variables: EnvVariable[] = [
  { key: "APP_BRAND_NAME", value: "Dowalet", comment: "后端报告中展示的品牌名称。", source: "file", sensitive: false },
  { key: "USER_LOGIN_URL", value: "http://localhost:5173/user/", comment: "用户端登录地址。", source: "file", sensitive: false },
  { key: "ADMIN_PASSWORD", value: "secret-123", comment: "管理端密码。", source: "file", sensitive: true }
];

test("filters env variables by variable name, value and comment with fuzzy matching", () => {
  assert.deepEqual(filterEnvVariables(variables, "brand").map((item) => item.key), ["APP_BRAND_NAME"]);
  assert.deepEqual(filterEnvVariables(variables, "5173").map((item) => item.key), ["USER_LOGIN_URL"]);
  assert.deepEqual(filterEnvVariables(variables, "管理端").map((item) => item.key), ["ADMIN_PASSWORD"]);
});

test("matches search query case-insensitively and ignores surrounding spaces", () => {
  assert.deepEqual(filterEnvVariables(variables, "  dowALET  ").map((item) => item.key), ["APP_BRAND_NAME"]);
});

test("keeps original index so filtered rows update the source variable", () => {
  const result = filterEnvVariables(variables, "password");

  assert.equal(result.length, 1);
  assert.equal(result[0]?.originalIndex, 2);
});

test("returns all variables when search query is blank", () => {
  assert.deepEqual(filterEnvVariables(variables, " ").map((item) => item.originalIndex), [0, 1, 2]);
});
