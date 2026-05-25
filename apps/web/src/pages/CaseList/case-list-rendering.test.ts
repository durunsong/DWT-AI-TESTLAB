import assert from "node:assert/strict";
import test from "node:test";
import { caseListRenderDelayMs, shouldRenderCreateCaseModal } from "./case-list-rendering";

test("defers create case modal until it is opened or submitting", () => {
  assert.equal(shouldRenderCreateCaseModal(false, false), false);
  assert.equal(shouldRenderCreateCaseModal(true, false), true);
  assert.equal(shouldRenderCreateCaseModal(false, true), true);
});

test("defers case list render commits outside the xhr loadend task", () => {
  assert.equal(caseListRenderDelayMs, 80);
});
