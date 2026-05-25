import assert from "node:assert/strict";
import test from "node:test";
import type { CaseTypeConfig } from "../../types/settings";
import { addEmptyCaseType, updateCaseTypeAt } from "./case-type-settings-utils";

const caseTypes: CaseTypeConfig[] = [
  { key: "uncategorized", label: "未分类", enabled: true, sort: 0 },
  { key: "smoke", label: "冒烟", enabled: true, sort: 20 }
];

test("updates one case type without changing other rows", () => {
  const result = updateCaseTypeAt(caseTypes, 1, { description: "冒烟测试" });

  assert.deepEqual(result[0], caseTypes[0]);
  assert.equal(result[1]?.description, "冒烟测试");
});

test("adds empty case type after the last sort value", () => {
  const result = addEmptyCaseType(caseTypes);

  assert.deepEqual(result.at(-1), {
    key: "",
    label: "",
    enabled: true,
    sort: 30
  });
});
