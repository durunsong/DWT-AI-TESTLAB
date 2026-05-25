import assert from "node:assert/strict";
import test from "node:test";
import { envVariablePageSize, routeContextLoadDelayMs, sensitiveUsernameFormName, sensitiveValueFormName } from "./settings-rendering";

test("keeps each sensitive env value in its own browser form", () => {
  assert.equal(sensitiveUsernameFormName(0), "env-sensitive-username-0");
  assert.equal(sensitiveValueFormName(0), "env-sensitive-value-0");
  assert.equal(sensitiveUsernameFormName(12), "env-sensitive-username-12");
  assert.equal(sensitiveValueFormName(12), "env-sensitive-value-12");
});

test("limits editable env rows rendered on the first settings paint", () => {
  assert.equal(envVariablePageSize, 20);
});

test("defers route context loading until after the settings first paint", () => {
  assert.equal(routeContextLoadDelayMs, 160);
});
