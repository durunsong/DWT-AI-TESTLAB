import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseSourceOptions, createCaseYamlFromSource } from "./case-source";
import type { CaseItem } from "../../types/case";

const cases: CaseItem[] = [
  { caseId: "kyc_submit", caseName: "KYC submit", caseType: "uncategorized", mode: "web", total: 4, valid: true },
  { caseId: "login_user", caseName: "User login", caseType: "uncategorized", mode: "web", total: 3, valid: true },
  { caseId: "broken_case", caseName: "Broken", caseType: "uncategorized", mode: "invalid", total: 0, valid: false },
  { caseId: "login_admin", caseName: "Admin login", caseType: "uncategorized", mode: "web", total: 3, valid: true },
  { caseId: "account_update", caseName: "Account update", caseType: "uncategorized", mode: "web", total: 5, valid: true }
];

test("builds searchable source options with preferred cases first", () => {
  assert.deepEqual(buildCaseSourceOptions(cases).map((item) => item.value), [
    "login_user",
    "login_admin",
    "kyc_submit",
    "account_update"
  ]);
});

test("keeps case type on case source options", () => {
  const [option] = buildCaseSourceOptions([
    { caseId: "smoke_case", caseName: "Smoke case", caseType: "smoke", mode: "web", total: 1, valid: true }
  ]);

  assert.equal(option?.caseType, "smoke");
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

  assert.match(yaml, /^case_id: login_user_sit\ncase_name: "User login SIT"\ncase_type: uncategorized\ndescription: "SIT login flow"\nmode: web/m);
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

  assert.match(yaml, /^case_id: login_admin_copy\ncase_name: "Admin login copy"\ncase_type: uncategorized\nmode: web/m);
});
