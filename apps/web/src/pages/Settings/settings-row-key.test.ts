import assert from "node:assert/strict";
import test from "node:test";
import { caseTypeRowKey, envVariableRowKey } from "./settings-row-key";

test("keeps case type row key stable while editing key input", () => {
  assert.equal(caseTypeRowKey({ originalIndex: 1, key: "" }), "case-type-1");
  assert.equal(caseTypeRowKey({ originalIndex: 1, key: "s" }), "case-type-1");
  assert.equal(caseTypeRowKey({ originalIndex: 1, key: "smoke" }), "case-type-1");
});

test("keeps env variable row key stable while editing variable name", () => {
  assert.equal(envVariableRowKey({ originalIndex: 2, key: "" }), "env-variable-2");
  assert.equal(envVariableRowKey({ originalIndex: 2, key: "A" }), "env-variable-2");
  assert.equal(envVariableRowKey({ originalIndex: 2, key: "API_BASE_URL" }), "env-variable-2");
});
