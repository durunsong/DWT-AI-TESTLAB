import assert from "node:assert/strict";
import test from "node:test";
import type { CaseItem } from "../../types/case";
import { buildBatchRunRequest, filterCasesByType } from "./case-batch";

const cases: CaseItem[] = [
  { caseId: "old_case", caseName: "旧用例", caseType: "uncategorized", mode: "web", total: 1, valid: true },
  { caseId: "smoke_case", caseName: "冒烟用例", caseType: "smoke", mode: "web", total: 1, valid: true },
  { caseId: "broken_smoke", caseName: "损坏冒烟", caseType: "smoke", mode: "web", total: 1, valid: false }
];

test("filters cases by case type and keeps all when type is empty", () => {
  assert.deepEqual(filterCasesByType(cases, "").map((item) => item.caseId), ["old_case", "smoke_case", "broken_smoke"]);
  assert.deepEqual(filterCasesByType(cases, "smoke").map((item) => item.caseId), ["smoke_case", "broken_smoke"]);
});

test("builds batch run request from selected runnable cases", () => {
  assert.deepEqual(buildBatchRunRequest(cases, ["smoke_case", "broken_smoke", "missing"], "sit"), {
    env: "sit",
    caseIds: ["smoke_case"]
  });
});
