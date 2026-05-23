import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseSourceOptions, createCaseYamlFromSource } from "./case-source";
import type { CaseItem } from "../../types/case";

const cases: CaseItem[] = [
  { caseId: "kyc_submit", caseName: "KYC submit", mode: "web", total: 4, valid: true },
  { caseId: "login_user", caseName: "User login", mode: "web", total: 3, valid: true },
  { caseId: "broken_case", caseName: "Broken", mode: "invalid", total: 0, valid: false },
  { caseId: "login_admin", caseName: "Admin login", mode: "web", total: 3, valid: true },
  { caseId: "account_update", caseName: "Account update", mode: "web", total: 5, valid: true }
];

test("builds searchable source options with preferred cases first", () => {
  assert.deepEqual(buildCaseSourceOptions(cases).map((item) => item.value), [
    "login_user",
    "login_admin",
    "kyc_submit",
    "account_update"
  ]);
});

test("creates a new case yaml from source content and replaces metadata", () => {
  const yaml = createCaseYamlFromSource(
    [
      "case_id: login_user",
      "case_name: User login",
      "description: Old description",
      "mode: web",
      "steps:",
      "  - step_id: open_login",
      "    name: Open login",
      "    type: web_open"
    ].join("\n"),
    {
      caseId: "login_user_sit",
      caseName: "User login SIT",
      description: "SIT login flow"
    }
  );

  assert.match(yaml, /^case_id: login_user_sit\ncase_name: "User login SIT"\ndescription: "SIT login flow"\nmode: web/m);
  assert.match(yaml, /step_id: open_login/);
});

test("inserts missing description after case_name when cloning source yaml", () => {
  const yaml = createCaseYamlFromSource(
    ["case_id: login_admin", "case_name: Admin login", "mode: web", "steps: []"].join("\n"),
    {
      caseId: "login_admin_copy",
      caseName: "Admin login copy"
    }
  );

  assert.match(yaml, /^case_id: login_admin_copy\ncase_name: "Admin login copy"\nmode: web/m);
});
